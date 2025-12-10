<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { Save, Upload, Check, AlertCircle, CheckCircle, Download } from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import type { Recording, RecordingType, RecordingUpdate } from "@/api";
	import { supabase } from "@/api";

	export let recording: Recording | null = null;
	export let isOpen = false;

	const dispatch = createEventDispatcher();

	let saving = false;
	let uploading = false;
	let fileInput: HTMLInputElement;
	let selectedFile: File | null = null;

	// Form fields
	let formData: Partial<Recording> = {
		title: "",
		author: "",
		description: "",
		type: "unknown",
		link_out_url: "",
		cover_url: "",
		captions_url: "",
	};

	// Recording types
	const recordingTypes: RecordingType[] = [
		"unknown",
		"jingle",
		"poetry",
		"music",
		"news",
		"commentary",
		"talk",
		"comedy",
		"talkshow",
		"interview",
		"other",
	];

	// Reset form when recording changes
	$: if (recording) {
		formData = {
			title: recording.title || "",
			author: recording.author || "",
			description: recording.description || "",
			type: recording.type || "unknown",
			link_out_url: recording.link_out_url || "",
			cover_url: recording.cover_url || "",
			captions_url: recording.captions_url || "",
		};
	}

	function closeModal() {
		isOpen = false;
		selectedFile = null;
		if (fileInput) fileInput.value = "";
		dispatch("close");
	}

	async function handleSave() {
		if (!recording) return;

		try {
			saving = true;
			const {
				data: { user },
			} = await supabase.auth.getUser();

			const updateData: RecordingUpdate = {
				...formData,
				edited_at: new Date().toISOString(),
				edited_by: user?.id || null,
			};

			const { error } = await supabase.from("recordings").update(updateData).eq("id", recording.id);

			if (error) throw error;

			toast.success("Recording updated successfully");
			dispatch("updated");
		} catch (error) {
			toast.error("Failed to update recording");
			console.error(error);
		} finally {
			saving = false;
		}
	}

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			selectedFile = input.files[0];
			// Validate file type
			if (!selectedFile.type.startsWith("audio/")) {
				toast.error("Please select an audio file");
				selectedFile = null;
				return;
			}
		}
	}

	async function handleUploadNewFile() {
		if (!selectedFile || !recording) return;

		try {
			uploading = true;

			// Delete old file first (if exists)
			const oldFileName = recording.file_url.split("/").pop();
			if (oldFileName) {
				await supabase.storage.from("recordings").remove([oldFileName]);
			}

			// Upload new file with same ID
			const fileExt = selectedFile.name.split(".").pop();
			const fileName = `${recording.id}.${fileExt}`;

			const { error: uploadError } = await supabase.storage
				.from("recordings")
				.upload(fileName, selectedFile, {
					upsert: true,
				});

			if (uploadError) throw uploadError;

			// Get public URL
			const { data: urlData } = supabase.storage.from("recordings").getPublicUrl(fileName);

			// Get duration of new file
			const audio = new Audio();
			audio.src = URL.createObjectURL(selectedFile);

			await new Promise((resolve) => {
				audio.addEventListener("loadedmetadata", resolve);
				audio.load();
			});

			const duration = Math.floor(audio.duration);

			// Update database with new file info
			const {
				data: { user },
			} = await supabase.auth.getUser();

			const { error: dbError } = await supabase
				.from("recordings")
				.update({
					file_url: urlData.publicUrl,
					file_size: selectedFile.size,
					duration: duration,
					edited_at: new Date().toISOString(),
					edited_by: user?.id || null,
				})
				.eq("id", recording.id);

			if (dbError) throw dbError;

			toast.success("Audio file replaced successfully");
			selectedFile = null;
			fileInput.value = "";
			dispatch("updated");
		} catch (error) {
			toast.error("Failed to upload new audio file");
			console.error(error);
		} finally {
			uploading = false;
		}
	}

	async function markAsOK() {
		if (!recording) return;

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			// Mark as OK by setting okey_at and okey_by
			const { error } = await supabase
				.from("recordings")
				.update({
					okey_at: new Date().toISOString(),
					okey_by: user?.id || null,
					edited_at: new Date().toISOString(),
					edited_by: user?.id || null,
				})
				.eq("id", recording.id);

			if (error) throw error;

			recording = {
				...recording,
				okey_at: new Date().toISOString(),
				okey_by: user?.id || null,
				edited_at: new Date().toISOString(),
				edited_by: user?.id || null,
			};
			toast.success("Recording marked as OK");
			dispatch("updated");
		} catch (error) {
			toast.error("Failed to mark recording as OK");
			console.error(error);
		}
	}

	async function markAsNotOK() {
		if (!recording) return;

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			// Mark as not OK by clearing okey_at and okey_by
			const { error } = await supabase
				.from("recordings")
				.update({
					okey_at: null,
					okey_by: null,
					edited_at: new Date().toISOString(),
					edited_by: user?.id || null,
				})
				.eq("id", recording.id);

			if (error) throw error;

			recording = {
				...recording,
				okey_at: null,
				okey_by: null,
				edited_at: new Date().toISOString(),
				edited_by: user?.id || null,
			};
			toast.success("Recording marked as not OK");
			dispatch("updated");
		} catch (error) {
			toast.error("Failed to mark recording as not OK");
			console.error(error);
		}
	}
	function formatFileSize(bytes: number) {
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(2)} MB`;
	}

	function formatDuration(seconds: number) {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	}

	function formatDateTime(date: string | null) {
		if (!date) return "N/A";
		return new Date(date).toLocaleString();
	}

	// Handle escape key
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Escape" && isOpen) {
			closeModal();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<div class="modal is-active">
		<div
			class="modal-background"
			on:click={closeModal}
			on:keydown={handleKeydown}
			role="button"
			tabindex="-1"
			aria-label="Close modal"
		></div>
		<div class="modal-card modal-card-wide">
			<header class="modal-card-head">
				<p class="modal-card-title">
					Edit Recording
					{#if recording}
						<span class="is-size-6 has-text-grey-light ml-2">ID: {recording.id}</span>
					{/if}
				</p>
				<button class="delete" aria-label="close" on:click={closeModal}></button>
			</header>

			<section class="modal-card-body">
				{#if recording}
					<div class="columns">
						<!-- Main form column -->
						<div class="column is-8">
							<h3 class="title is-5 mb-4">Recording Details</h3>
							<form on:submit|preventDefault={handleSave}>
								<div class="field">
									<label class="label" for="modal-title">Title</label>
									<div class="control">
										<input
											id="modal-title"
											class="input"
											type="text"
											bind:value={formData.title}
											placeholder="Recording title"
										/>
									</div>
								</div>

								<div class="field">
									<label class="label" for="modal-author">Author</label>
									<div class="control">
										<input
											id="modal-author"
											class="input"
											type="text"
											bind:value={formData.author}
											placeholder="Author name"
										/>
									</div>
								</div>

								<div class="field">
									<label class="label" for="modal-description">Description</label>
									<div class="control">
										<textarea
											id="modal-description"
											class="textarea"
											bind:value={formData.description}
											placeholder="Detailed description of the recording"
											rows="4"
										/>
									</div>
								</div>

								<div class="field">
									<label class="label" for="modal-type">Type</label>
									<div class="control">
										<div class="select is-fullwidth">
											<select id="modal-type" bind:value={formData.type}>
												{#each recordingTypes as type}
													<option value={type}>{type}</option>
												{/each}
											</select>
										</div>
									</div>
								</div>

								<div class="field">
									<label class="label" for="modal-link">External Link</label>
									<div class="control">
										<input
											id="modal-link"
											class="input"
											type="url"
											bind:value={formData.link_out_url}
											placeholder="https://example.com"
										/>
									</div>
									<p class="help">Optional external URL for promotional purposes</p>
								</div>

								<div class="field">
									<label class="label" for="modal-cover">Cover Image URL</label>
									<div class="control">
										<input
											id="modal-cover"
											class="input"
											type="url"
											bind:value={formData.cover_url}
											placeholder="https://example.com/image.jpg"
										/>
									</div>
									<p class="help">URL to cover art image</p>
								</div>

								<div class="field">
									<label class="label" for="modal-captions">Captions URL</label>
									<div class="control">
										<input
											id="modal-captions"
											class="input"
											type="url"
											bind:value={formData.captions_url}
											placeholder="https://example.com/captions.json"
										/>
									</div>
									<p class="help">URL to captions JSON file</p>
								</div>
							</form>

							<!-- Audio replacement section -->
							<div class="box mt-5">
								<h4 class="title is-6 mb-3">Replace Audio File</h4>
								<div class="field">
									<div class="file has-name is-fullwidth">
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
												<span class="file-label"> Choose audio file... </span>
											</span>
											<span class="file-name">
												{selectedFile ? selectedFile.name : "No file selected"}
											</span>
										</label>
									</div>
									{#if selectedFile}
										<div class="mt-3">
											<button
												class="button is-warning"
												on:click={handleUploadNewFile}
												disabled={uploading}
											>
												{uploading ? "Uploading..." : "Replace Audio File"}
											</button>
											<p class="help is-danger mt-2">
												Warning: This will permanently replace the current audio file
											</p>
										</div>
									{/if}
								</div>
							</div>
						</div>

						<!-- Info and status column -->
						<div class="column is-4">
							<div class="box">
								<h4 class="title is-6 mb-3">File Information</h4>
								<div class="content is-small">
									<p><strong>Filename:</strong> {recording.uploaded_filename}</p>
									<p><strong>Duration:</strong> {formatDuration(recording.duration)}</p>
									<p><strong>Size:</strong> {formatFileSize(recording.file_size)}</p>
									<p><strong>Uploaded:</strong> {formatDateTime(recording.uploaded_at)}</p>
									{#if recording.edited_at && recording.edited_at !== recording.uploaded_at}
										<p><strong>Last edited:</strong> {formatDateTime(recording.edited_at)}</p>
									{/if}
									{#if recording.okey_at}
										<p><strong>Marked OK:</strong> {formatDateTime(recording.okey_at)}</p>
									{/if}
								</div>

								<!-- Audio preview -->
								<div class="field mt-4">
									<p class="label is-size-7">Preview</p>
									<audio controls src={recording.file_url} class="is-fullwidth" />
								</div>

								<!-- Download button -->
								<div class="field mt-3">
									{#if recording}
										<a
											class="button is-info is-fullwidth"
											href={recording.file_url}
											download={recording.uploaded_filename}
											target="_blank"
										>
											<span class="icon">
												<Download />
											</span>
											<span>Download Audio</span>
										</a>
									{/if}
								</div>
							</div>

							<div class="box mt-4">
								<h4 class="title is-6 mb-3">Status</h4>
								<div class="field">
									<div
										class="notification is-light"
										class:is-success={recording.okey_at !== null}
										class:is-warning={recording.okey_at === null}
									>
										{#if recording.okey_at === null}
											<span class="icon">
												<AlertCircle />
											</span>
											<span class="has-text-weight-semibold"> Recording is marked as NOT OK </span>
										{:else}
											<span class="icon">
												<CheckCircle />
											</span>
											<span class="has-text-weight-semibold"> Recording is marked as OK </span>
										{/if}
									</div>
									<div class="buttons">
										{#if recording.okey_at === null}
											<button class="button is-success is-fullwidth" on:click={markAsOK}>
												<span class="icon">
													<Check />
												</span>
												<span>Mark as OK</span>
											</button>
										{:else}
											<button class="button is-fullwidth is-small" on:click={markAsNotOK}>
												<span>Mark as NOT OK</span>
											</button>
										{/if}
									</div>
									<p class="help">
										{#if recording.okey_at === null}
											This recording will not appear in the player or be available for programs
										{:else}
											This recording is available for playback and can be added to programs
										{/if}
									</p>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</section>

			<footer class="modal-card-foot">
				<button class="button is-primary" on:click={handleSave} disabled={saving}>
					<span class="icon">
						<Save />
					</span>
					<span>{saving ? "Saving..." : "Save Changes"}</span>
				</button>
				<button class="button" on:click={closeModal}>Cancel</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	.modal-card-wide {
		width: 90%;
		max-width: 1200px;
	}

	audio {
		width: 100%;
	}

	.file.is-fullwidth {
		width: 100%;
	}

	.file.is-fullwidth .file-name {
		flex-grow: 1;
		max-width: 100%;
	}

	.content.is-small p {
		margin-bottom: 0.5rem;
	}
</style>
