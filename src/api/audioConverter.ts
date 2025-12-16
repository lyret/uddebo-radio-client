/**
 * Audio converter utility for browser-based audio conversion to MP3
 */

import { toast } from "svelte-sonner";

/**
 * Audio conversion options
 */
export interface AudioConversionOptions {
	/** Target bitrate for MP3 encoding (in kbps). Default: 128 */
	bitrate?: number;
	/** Target sample rate. Default: 44100 */
	sampleRate?: number;
	/** Show progress notifications during conversion */
	showProgress?: boolean;
}

/**
 * Result of audio conversion
 */
export interface AudioConversionResult {
	/** The converted audio file as MP3 */
	file: File;
	/** Duration of the audio in seconds */
	duration: number;
	/** Original file information */
	originalFile: {
		name: string;
		size: number;
		type: string;
	};
}

/**
 * Dynamically loads the lamejs library for MP3 encoding
 */
async function loadLameJs(): Promise<any> {
	// Check if already loaded
	if ((window as any).lamejs) {
		return (window as any).lamejs;
	}

	// Create script element
	const script = document.createElement("script");
	script.src = "https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js";

	// Load script
	return new Promise((resolve, reject) => {
		script.onload = () => {
			if ((window as any).lamejs) {
				resolve((window as any).lamejs);
			} else {
				reject(new Error("Failed to load lamejs library"));
			}
		};
		script.onerror = () => reject(new Error("Failed to load lamejs library"));
		document.head.appendChild(script);
	});
}

/**
 * Converts an audio file to MP3 format in the browser
 * @param audioFile The audio file to convert
 * @param options Conversion options
 * @returns The converted MP3 file and metadata
 */
export async function convertAudioToMp3(
	audioFile: File,
	options: AudioConversionOptions = {}
): Promise<AudioConversionResult> {
	const { bitrate = 128, sampleRate = 44100, showProgress = true } = options;

	try {
		if (showProgress) {
			toast.loading("Förbereder ljudkonvertering...", { id: "audio-conversion" });
		}

		// Load lamejs library
		const lamejs = await loadLameJs();

		// Read file as array buffer
		const arrayBuffer = await audioFile.arrayBuffer();

		// Create audio context for decoding
		const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

		if (showProgress) {
			toast.loading("Avkodar ljudfil...", { id: "audio-conversion" });
		}

		// Decode audio data
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

		// Get audio properties
		const channels = Math.min(audioBuffer.numberOfChannels, 2); // Max 2 channels for MP3
		const originalSampleRate = audioBuffer.sampleRate;
		const duration = audioBuffer.duration;

		// Prepare channel data
		const channelData: Int16Array[] = [];
		for (let channel = 0; channel < channels; channel++) {
			const floatData = audioBuffer.getChannelData(channel);
			const int16Data = new Int16Array(floatData.length);

			// Convert float32 to int16
			for (let i = 0; i < floatData.length; i++) {
				const sample = Math.max(-1, Math.min(1, floatData[i]));
				int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
			}

			channelData.push(int16Data);
		}

		if (showProgress) {
			toast.loading("Konverterar till MP3...", { id: "audio-conversion" });
		}

		// Create MP3 encoder
		const mp3Encoder = new lamejs.Mp3Encoder(channels, originalSampleRate, bitrate);

		// Encode to MP3
		const mp3Data: Int8Array[] = [];
		const blockSize = 1152; // Must be multiple of 576
		const length = channelData[0].length;

		for (let i = 0; i < length; i += blockSize) {
			const leftChunk = channelData[0].subarray(i, Math.min(i + blockSize, length));
			const rightChunk =
				channels > 1 ? channelData[1].subarray(i, Math.min(i + blockSize, length)) : undefined;

			let mp3buf: Int8Array;
			if (channels === 2 && rightChunk) {
				mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
			} else {
				mp3buf = mp3Encoder.encodeBuffer(leftChunk);
			}

			if (mp3buf.length > 0) {
				mp3Data.push(mp3buf);
			}
		}

		// Flush encoder
		const mp3buf = mp3Encoder.flush();
		if (mp3buf.length > 0) {
			mp3Data.push(mp3buf);
		}

		// Calculate total size
		const totalSize = mp3Data.reduce((acc, buf) => acc + buf.length, 0);

		// Merge all chunks
		const mp3Result = new Uint8Array(totalSize);
		let offset = 0;
		for (const chunk of mp3Data) {
			mp3Result.set(chunk, offset);
			offset += chunk.length;
		}

		// Create blob and file
		const mp3Blob = new Blob([mp3Result], { type: "audio/mp3" });
		const originalName = audioFile.name.replace(/\.[^/.]+$/, "");
		const mp3File = new File([mp3Blob], `${originalName}.mp3`, { type: "audio/mp3" });

		// Clean up
		audioContext.close();

		if (showProgress) {
			toast.success("Ljudfil konverterad till MP3!", { id: "audio-conversion" });
		}

		return {
			file: mp3File,
			duration: Math.floor(duration),
			originalFile: {
				name: audioFile.name,
				size: audioFile.size,
				type: audioFile.type,
			},
		};
	} catch (error) {
		if (showProgress) {
			toast.error("Konvertering misslyckades", {
				id: "audio-conversion",
				description: error instanceof Error ? error.message : "Ett okänt fel uppstod",
			});
		}
		throw error;
	}
}

/**
 * Checks if an audio file needs conversion (i.e., is not already MP3)
 * @param file The audio file to check
 * @returns True if the file needs conversion
 */
export function needsAudioConversion(file: File): boolean {
	// Check MIME type
	if (file.type === "audio/mpeg" || file.type === "audio/mp3") {
		return false;
	}

	// Check file extension as fallback
	const extension = file.name.split(".").pop()?.toLowerCase();
	return extension !== "mp3";
}

/**
 * Converts a Blob (such as WAV from audio processing) to MP3
 * @param blob The audio blob to convert
 * @param fileName Optional filename for the resulting file
 * @returns The converted MP3 blob
 */
export async function convertAudioToMp3FromBlob(
	blob: Blob,
	fileName: string = "audio.mp3"
): Promise<Blob> {
	// Create a File from the Blob to use existing conversion
	const tempFile = new File([blob], "temp_audio.wav", { type: blob.type });

	// Convert using existing function
	const result = await convertAudioToMp3(tempFile, { showProgress: false });

	// Return just the blob
	return new Blob([result.file], { type: "audio/mp3" });
}

/**
 * Gets a human-readable description of the audio format
 * @param file The audio file
 * @returns Format description
 */
export function getAudioFormatDescription(file: File): string {
	const extension = file.name.split(".").pop()?.toLowerCase() || "unknown";
	const formats: Record<string, string> = {
		mp3: "MP3",
		wav: "WAV",
		m4a: "M4A/AAC",
		ogg: "OGG Vorbis",
		webm: "WebM",
		flac: "FLAC",
		aac: "AAC",
		opus: "Opus",
		wma: "WMA",
		aiff: "AIFF",
		mp4: "MP4 Audio",
	};

	return formats[extension] || extension.toUpperCase();
}

/**
 * Validates audio file before processing
 * @param file The audio file to validate
 * @param maxSizeMB Maximum file size in MB
 * @returns Error message if invalid, null if valid
 */
export function validateAudioFile(file: File, maxSizeMB = 50): string | null {
	// Check if it's an audio file
	if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
		// Check extension as fallback
		const extension = file.name.split(".").pop()?.toLowerCase();
		const audioExtensions = [
			"mp3",
			"wav",
			"m4a",
			"ogg",
			"webm",
			"flac",
			"aac",
			"opus",
			"wma",
			"aiff",
			"mp4",
		];
		if (!extension || !audioExtensions.includes(extension)) {
			return "Vänligen välj en ljudfil";
		}
	}

	// Check file size
	if (file.size > maxSizeMB * 1024 * 1024) {
		return `Filen är för stor. Maximal storlek är ${maxSizeMB}MB`;
	}

	return null;
}
