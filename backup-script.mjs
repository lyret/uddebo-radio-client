import https from "https";
import fs from "fs";
import path from "path";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase configuration
const SUPABASE_URL = "https://zkftcwrmauaqlinlsvxs.supabase.co";
const SUPABASE_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprZnRjd3JtYXVhcWxpbmxzdnhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4ODkyODgsImV4cCI6MjA3MjQ2NTI4OH0.xmzzitNotj-XlY16A--uYzU7a_zMKOjBHWqd2k5SPPo";

// Create backup directory
const backupDir = path.join(__dirname, `supabase-backup-${new Date().toISOString().split("T")[0]}`);
const recordingsDir = path.join(backupDir, "recordings");
const programsDir = path.join(backupDir, "programs");
const coversDir = path.join(backupDir, "covers");
const audioDir = path.join(backupDir, "audio");

// Create directories
[backupDir, recordingsDir, programsDir, coversDir, audioDir].forEach((dir) => {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
});

// Helper function to make Supabase API calls
async function supabaseRequest(endpoint, options = {}) {
	return new Promise((resolve, reject) => {
		const url = new URL(`${SUPABASE_URL}/rest/v1/${endpoint}`);

		const requestOptions = {
			hostname: url.hostname,
			path: url.pathname + url.search,
			method: options.method || "GET",
			headers: {
				apikey: SUPABASE_KEY,
				Authorization: `Bearer ${SUPABASE_KEY}`,
				"Content-Type": "application/json",
				Prefer: "return=representation",
				...options.headers,
			},
		};

		const req = https.request(requestOptions, (res) => {
			let data = "";
			res.on("data", (chunk) => (data += chunk));
			res.on("end", () => {
				if (res.statusCode >= 200 && res.statusCode < 300) {
					try {
						resolve(JSON.parse(data));
					} catch (e) {
						resolve(data);
					}
				} else {
					reject(new Error(`HTTP ${res.statusCode}: ${data}`));
				}
			});
		});

		req.on("error", reject);

		if (options.body) {
			req.write(JSON.stringify(options.body));
		}

		req.end();
	});
}

// Helper function to download a file
async function downloadFile(url, destination) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(destination);

		https
			.get(url, (response) => {
				if (response.statusCode === 200) {
					response.pipe(file);

					file.on("finish", () => {
						file.close();
						resolve();
					});

					file.on("error", (err) => {
						fs.unlink(destination, () => {});
						reject(err);
					});
				} else {
					file.close();
					fs.unlink(destination, () => {});
					reject(new Error(`Failed to download: ${response.statusCode}`));
				}
			})
			.on("error", (err) => {
				fs.unlink(destination, () => {});
				reject(err);
			});
	});
}

// Extract filename from URL
function getFilenameFromUrl(url) {
	if (!url) return null;
	const parts = url.split("/");
	return parts[parts.length - 1].split("?")[0];
}

// Main backup function
async function backupSupabase() {
	console.log("🚀 Starting Supabase backup...\n");

	try {
		// Fetch all recordings
		console.log("📊 Fetching recordings...");
		const recordings = await supabaseRequest("recordings?select=*");
		console.log(`  ✓ Found ${recordings.length} recordings`);

		// Fetch all broadcast programs
		console.log("\n📻 Fetching broadcast programs...");
		const programs = await supabaseRequest("broadcast_programs?select=*");
		console.log(`  ✓ Found ${programs.length} programs`);

		// Save metadata
		console.log("\n💾 Saving metadata...");
		fs.writeFileSync(
			path.join(backupDir, "metadata.json"),
			JSON.stringify(
				{
					backup_date: new Date().toISOString(),
					source: SUPABASE_URL,
					statistics: {
						total_recordings: recordings.length,
						total_programs: programs.length,
						total_size_bytes: recordings.reduce((sum, r) => sum + (r.file_size || 0), 0),
					},
				},
				null,
				2
			)
		);

		// Process recordings
		console.log("\n📥 Downloading recording files...");
		let downloadedCount = 0;
		let failedDownloads = [];

		for (let i = 0; i < recordings.length; i++) {
			const recording = recordings[i];
			const recordingDir = path.join(recordingsDir, recording.id);

			if (!fs.existsSync(recordingDir)) {
				fs.mkdirSync(recordingDir, { recursive: true });
			}

			// Save recording metadata
			fs.writeFileSync(path.join(recordingDir, "data.json"), JSON.stringify(recording, null, 2));

			console.log(
				`\n[${i + 1}/${recordings.length}] Processing: ${recording.title || recording.uploaded_filename}`
			);

			// Download audio file
			if (recording.file_url) {
				try {
					const audioFilename = getFilenameFromUrl(recording.file_url) || `${recording.id}.mp3`;
					const audioPath = path.join(recordingDir, audioFilename);
					console.log(`  ⬇️  Audio: ${audioFilename}`);
					await downloadFile(recording.file_url, audioPath);
					console.log(`  ✓ Audio downloaded`);
					downloadedCount++;
				} catch (err) {
					console.log(`  ✗ Audio download failed: ${err.message}`);
					failedDownloads.push({ id: recording.id, type: "audio", error: err.message });
				}
			}

			// Download cover image
			if (recording.cover_url) {
				try {
					const coverFilename =
						getFilenameFromUrl(recording.cover_url) || `${recording.id}-cover.jpg`;
					const coverPath = path.join(recordingDir, coverFilename);
					console.log(`  ⬇️  Cover: ${coverFilename}`);
					await downloadFile(recording.cover_url, coverPath);
					console.log(`  ✓ Cover downloaded`);
				} catch (err) {
					console.log(`  ✗ Cover download failed: ${err.message}`);
					failedDownloads.push({ id: recording.id, type: "cover", error: err.message });
				}
			}

			// Download captions if available
			if (recording.captions_url) {
				try {
					const captionsFilename =
						getFilenameFromUrl(recording.captions_url) || `${recording.id}-captions.vtt`;
					const captionsPath = path.join(recordingDir, captionsFilename);
					console.log(`  ⬇️  Captions: ${captionsFilename}`);
					await downloadFile(recording.captions_url, captionsPath);
					console.log(`  ✓ Captions downloaded`);
				} catch (err) {
					console.log(`  ✗ Captions download failed: ${err.message}`);
					failedDownloads.push({ id: recording.id, type: "captions", error: err.message });
				}
			}
		}

		// Process broadcast programs
		console.log("\n\n📻 Processing broadcast programs...");
		for (let i = 0; i < programs.length; i++) {
			const program = programs[i];
			const programDir = path.join(programsDir, program.id);

			if (!fs.existsSync(programDir)) {
				fs.mkdirSync(programDir, { recursive: true });
			}

			// Save program metadata
			fs.writeFileSync(path.join(programDir, "data.json"), JSON.stringify(program, null, 2));

			console.log(`\n[${i + 1}/${programs.length}] Processing program: ${program.title}`);

			// Download program cover
			if (program.cover_url) {
				try {
					const coverFilename = getFilenameFromUrl(program.cover_url) || `${program.id}-cover.jpg`;
					const coverPath = path.join(programDir, coverFilename);
					console.log(`  ⬇️  Cover: ${coverFilename}`);
					await downloadFile(program.cover_url, coverPath);
					console.log(`  ✓ Cover downloaded`);
				} catch (err) {
					console.log(`  ✗ Cover download failed: ${err.message}`);
					failedDownloads.push({ id: program.id, type: "program_cover", error: err.message });
				}
			}
		}

		// Create summary
		const summary = {
			backup_completed: new Date().toISOString(),
			backup_location: backupDir,
			statistics: {
				total_recordings: recordings.length,
				total_programs: programs.length,
				files_downloaded: downloadedCount,
				failed_downloads: failedDownloads.length,
				total_size_mb: Math.round(
					recordings.reduce((sum, r) => sum + (r.file_size || 0), 0) / 1024 / 1024
				),
			},
			failed_downloads: failedDownloads,
		};

		// Save summary
		fs.writeFileSync(path.join(backupDir, "backup-summary.json"), JSON.stringify(summary, null, 2));

		// Save full data dumps
		fs.writeFileSync(
			path.join(backupDir, "all-recordings.json"),
			JSON.stringify(recordings, null, 2)
		);

		fs.writeFileSync(path.join(backupDir, "all-programs.json"), JSON.stringify(programs, null, 2));

		// Create index HTML for easy browsing
		const indexHtml = `<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Uddebo Radio Backup - ${new Date().toLocaleDateString("sv-SE")}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        h1 { color: #333; }
        .stats { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .recordings { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
        .recording { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .recording h3 { margin-top: 0; color: #2c3e50; }
        .recording audio { width: 100%; margin-top: 10px; }
        .metadata { font-size: 0.9em; color: #666; }
        .cover { max-width: 100%; height: auto; border-radius: 4px; margin-bottom: 10px; }
    </style>
</head>
<body>
    <h1>🎙️ Uddebo Radio Backup</h1>
    <div class="stats">
        <h2>Statistik</h2>
        <p>📅 Backup skapad: ${new Date().toLocaleString("sv-SE")}</p>
        <p>🎵 Antal inspelningar: ${recordings.length}</p>
        <p>📻 Antal program: ${programs.length}</p>
        <p>💾 Total storlek: ${Math.round(recordings.reduce((sum, r) => sum + (r.file_size || 0), 0) / 1024 / 1024)} MB</p>
        <p>✅ Nedladdade filer: ${downloadedCount}</p>
        ${failedDownloads.length > 0 ? `<p>⚠️ Misslyckade nedladdningar: ${failedDownloads.length}</p>` : ""}
    </div>

    <h2>Inspelningar</h2>
    <div class="recordings">
        ${recordings
					.map(
						(r) => `
        <div class="recording">
            <h3>${r.title || r.uploaded_filename || "Untitled"}</h3>
            ${r.cover_url ? `<img src="recordings/${r.id}/${getFilenameFromUrl(r.cover_url) || r.id + "-cover.jpg"}" class="cover" onerror="this.style.display='none'">` : ""}
            ${r.file_url ? `<audio controls src="recordings/${r.id}/${getFilenameFromUrl(r.file_url) || r.id + ".mp3"}"></audio>` : ""}
            <div class="metadata">
                <p>📝 ${r.description || "Ingen beskrivning"}</p>
                <p>👤 ${r.author || "Okänd författare"}</p>
                <p>⏱️ ${Math.round(r.duration / 60)} minuter</p>
                <p>📊 Typ: ${r.type || "unknown"}</p>
                <p>📅 ${new Date(r.uploaded_at).toLocaleDateString("sv-SE")}</p>
            </div>
        </div>
        `
					)
					.join("")}
    </div>
</body>
</html>`;

		fs.writeFileSync(path.join(backupDir, "index.html"), indexHtml);

		// Print summary
		console.log("\n\n" + "=".repeat(60));
		console.log("✅ BACKUP COMPLETED SUCCESSFULLY!");
		console.log("=".repeat(60));
		console.log(`📁 Backup location: ${backupDir}`);
		console.log(`📊 Total recordings: ${recordings.length}`);
		console.log(`📻 Total programs: ${programs.length}`);
		console.log(`💾 Files downloaded: ${downloadedCount}`);
		console.log(`📦 Total size: ${summary.statistics.total_size_mb} MB`);

		if (failedDownloads.length > 0) {
			console.log(`\n⚠️ Warning: ${failedDownloads.length} files failed to download`);
			console.log("Check backup-summary.json for details");
		}

		console.log("\n📌 You can browse the backup by opening:");
		console.log(`   ${path.join(backupDir, "index.html")}`);
	} catch (error) {
		console.error("\n❌ Backup failed:", error);
		process.exit(1);
	}
}

// Run backup
console.log("🎙️ UDDEBO RADIO SUPABASE BACKUP TOOL");
console.log("=====================================\n");
backupSupabase();
