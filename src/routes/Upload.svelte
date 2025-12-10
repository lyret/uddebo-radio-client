<script lang="ts">
	import { Upload, Music } from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import Layout from "@/components/Layout.svelte";
	import { supabase } from "@/api";

	let uploading = false;
	let selectedFile: File | null = null;
	let title = "";
	let author = "";
	let uploaderName = "";
	let uploaderEmail = "";
	let fileInput: HTMLInputElement;

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			// Check if it's an audio file
			if (!file.type.startsWith("audio/")) {
				toast.error("Invalid file type", {
					description: "Please select an audio file",
				});
				return;
			}

			// Check file size (limit to 50MB)
			if (file.size > 50 * 1024 * 1024) {
				toast.error("File too large", {
					description: "Please select a file smaller than 50MB",
				});
				return;
			}

			selectedFile = file;

			// Auto-fill title from filename if not already set
			if (!title) {
				const filename = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
				title = filename;
			}
		}
	}

	function removeFile() {
		selectedFile = null;
		if (fileInput) {
			fileInput.value = "";
		}
	}

	async function handleUpload() {
		if (!selectedFile || !title.trim()) {
			toast.error("Missing information", {
				description: "Please select a file and provide a title",
			});
			return;
		}

		uploading = true;

		try {
			// Check if user is authenticated (optional now)
			const {
				data: { user },
			} = await supabase.auth.getUser();

			// Upload file to storage
			const fileExt = selectedFile.name.split(".").pop();
			// Use user ID if authenticated, otherwise use anonymous folder
			const userFolder = user?.id || "anonymous";
			const fileName = `${userFolder}/${Date.now()}.${fileExt}`;

			const { error: uploadError } = await supabase.storage
				.from("recordings")
				.upload(fileName, selectedFile);

			if (uploadError) {
				console.error("uploadError:", uploadError);
				throw uploadError;
			}

			// Get public URL
			const {
				data: { publicUrl },
			} = supabase.storage.from("recordings").getPublicUrl(fileName);

			// Create audio element to get duration
			const audio = new Audio();
			audio.src = URL.createObjectURL(selectedFile);

			await new Promise((resolve) => {
				audio.addEventListener("loadedmetadata", resolve);
				audio.load();
			});

			const duration = Math.floor(audio.duration);

			// Save recording metadata to database
			const uploadedAt = new Date().toISOString();
			const recordingData = {
				title: title.trim() || null,
				author: author.trim() || null,
				file_url: publicUrl,
				file_size: selectedFile.size,
				duration,
				uploaded_by: user?.id || null,
				uploaded_at: uploadedAt,
				uploaded_filename: selectedFile.name,
				edited_at: uploadedAt,
				edited_by: user?.id || null,
				type: "unknown" as const,
			};

			const { error: dbError } = await supabase.from("recordings").insert(recordingData);

			if (dbError) throw dbError;

			toast.success("Upload successful!", {
				description: "Your recording has been added to the playlist",
			});

			// Reset form
			selectedFile = null;
			title = "";
			author = "";
			uploaderName = "";
			uploaderEmail = "";

			// Reset file input
			if (fileInput) {
				fileInput.value = "";
			}
		} catch (error) {
			console.error("Upload error:", error);
			toast.error("Upload failed", {
				description: "There was an error uploading your recording",
			});
		} finally {
			uploading = false;
		}
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	}
</script>

<Layout>
	<div>
		<h3 class="title is-4 has-text-centered">Upload Recording</h3>
		<p class="subtitle is-6 has-text-centered mb-5">Add your music to the Uddebo Radio playlist</p>

		<form on:submit|preventDefault={handleUpload}>
			<!-- File Upload -->
			<div class="field">
				<div class="file is-boxed is-centered">
					<label class="file-label">
						<input
							bind:this={fileInput}
							class="file-input"
							type="file"
							accept="audio/*"
							on:change={handleFileSelect}
						/>
						<span class="file-cta">
							<span class="file-icon">
								<Upload />
							</span>
							<span class="file-label">Choose an audio file...</span>
						</span>
					</label>
				</div>
				{#if selectedFile}
					<div class="notification is-light mt-3">
						<button type="button" class="delete" on:click={removeFile}></button>
						<div class="media">
							<div class="media-left">
								<span class="icon has-text-primary">
									<Music size={24} />
								</span>
							</div>
							<div class="media-content">
								<strong>{selectedFile.name}</strong>
								<br />
								<small>{formatFileSize(selectedFile.size)}</small>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Title -->
			<div class="field">
				<label class="label" for="title">Title *</label>
				<div class="control">
					<input
						id="title"
						class="input"
						type="text"
						bind:value={title}
						placeholder="Enter the song title"
						required
					/>
				</div>
			</div>

			<!-- Artist -->
			<div class="field">
				<label class="label" for="author">Author</label>
				<div class="control">
					<input
						id="author"
						class="input"
						type="text"
						bind:value={author}
						placeholder="Enter the author name"
					/>
				</div>
			</div>

			<!-- Optional Contact Info -->
			<hr />
			<h4 class="title is-5">Optional: Contact Information</h4>
			<p class="subtitle is-6">Help listeners connect with you</p>

			<div class="field">
				<label class="label" for="uploader-name">Your Name</label>
				<div class="control">
					<input
						id="uploader-name"
						class="input"
						type="text"
						bind:value={uploaderName}
						placeholder="Enter your name"
					/>
				</div>
			</div>

			<div class="field">
				<label class="label" for="uploader-email">Your Email</label>
				<div class="control">
					<input
						id="uploader-email"
						class="input"
						type="email"
						bind:value={uploaderEmail}
						placeholder="Enter your email"
					/>
				</div>
			</div>

			<!-- Upload Button -->
			<div class="field mt-5">
				<div class="control">
					<button
						type="submit"
						class="button is-primary is-fullwidth"
						disabled={!selectedFile || !title.trim() || uploading}
						class:is-loading={uploading}
					>
						<span class="icon">
							<Upload />
						</span>
						<span>Upload Recording</span>
					</button>
				</div>
			</div>
		</form>

		<div class="content has-text-centered mt-5">
			<small>
				By uploading, you confirm you have the rights to share this content.
				<br />
				Uploaded files will be publicly accessible on Uddebo Radio.
				<br />
				<strong class="has-text-primary">No account required - anyone can upload!</strong>
			</small>
		</div>
	</div>
</Layout>
