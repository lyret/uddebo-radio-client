<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { X, Upload, FileAudio, AlertCircle, Check, Trash2 } from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import type { Recording, RecordingType } from "@/api";
	import { supabase, uploadAudioFile, getFilenameWithDate } from "@/api";
	import { getSwedishRecordingType } from "@/api/lang";

	export let isOpen = false;

	const dispatch = createEventDispatcher();

	interface UploadItem {
		id: string;
		file: File;
		title: string;
		author: string;
		type: RecordingType;
		description: string;
		duration: number;
		status: "pending" | "uploading" | "success" | "error";
		error?: string;
		progress: number;
	}

	let fileInput: HTMLInputElement;
	let uploadItems: UploadItem[] = [];
	let isUploading = false;
	let dragOver = false;

	// Recording types with Swedish labels
	const recordingTypes: { value: RecordingType; label: string }[] = [
		{ value: "unknown", label: "Okänd" },
		{ value: "jingle", label: "Jingel" },
		{ value: "poetry", label: "Poesi" },
		{ value: "music", label: "Musik" },
		{ value: "news", label: "Nyheter" },
		{ value: "commentary", label: "Kommentar" },
		{ value: "talk", label: "Tal" },
		{ value: "comedy", label: "Komedi" },
		{ value: "talkshow", label: "Pratshow" },
		{ value: "interview", label: "Intervju" },
		{ value: "other", label: "Övrigt" },
	];

	$: if (!isOpen) {
		resetForm();
	}

	function resetForm() {
		uploadItems = [];
		if (fileInput) fileInput.value = "";
		isUploading = false;
		dragOver = false;
	}

	function handleClose() {
		if (isUploading) {
			if (!confirm("Uppladdning pågår. Är du säker på att du vill avbryta?")) {
				return;
			}
		}
		isOpen = false;
		dispatch("close");
	}

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files) {
			await addFiles(Array.from(input.files));
		}
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;

		if (event.dataTransfer?.files) {
			await addFiles(Array.from(event.dataTransfer.files));
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
	}

	async function addFiles(files: File[]) {
		const audioFiles = files.filter((file) => file.type.startsWith("audio/"));

		if (audioFiles.length === 0) {
			toast.error("Vänligen välj ljudfiler");
			return;
		}

		for (const file of audioFiles) {
			// Extract title from filename (remove extension)
			const title = file.name.replace(/\.[^/.]+$/, "");

			// Try to get duration
			const duration = await getAudioDuration(file);

			const uploadItem: UploadItem = {
				id: crypto.randomUUID(),
				file,
				title,
				author: "",
				type: "unknown",
				description: "",
				duration: duration || 0,
				status: "pending",
				progress: 0,
			};

			uploadItems = [...uploadItems, uploadItem];
		}
	}

	async function getAudioDuration(file: File): Promise<number> {
		return new Promise((resolve) => {
			const audio = new Audio();
			audio.addEventListener("loadedmetadata", () => {
				resolve(Math.round(audio.duration));
			});
			audio.addEventListener("error", () => {
				resolve(0);
			});
			audio.src = URL.createObjectURL(file);
		});
	}

	function removeItem(id: string) {
		uploadItems = uploadItems.filter((item) => item.id !== id);
	}

	function updateItem(id: string, updates: Partial<UploadItem>) {
		uploadItems = uploadItems.map((item) => (item.id === id ? { ...item, ...updates } : item));
	}

	async function startUpload() {
		if (uploadItems.length === 0) {
			toast.error("Inga filer att ladda upp");
			return;
		}

		isUploading = true;
		const {
			data: { user },
		} = await supabase.auth.getUser();

		let successCount = 0;
		let errorCount = 0;

		for (const item of uploadItems) {
			if (item.status === "success") continue;

			try {
				updateItem(item.id, { status: "uploading", progress: 10 });

				// Upload audio file with automatic conversion if needed
				const uploadResult = await uploadAudioFile({
					file: item.file,
					bucket: "recordings",
					folder: `batch/${item.id}`,
					showProgress: false, // We handle our own progress
					autoConvert: true,
					maxSizeMB: 50,
				});

				updateItem(item.id, { progress: 50 });

				// Create database record
				const uploadedAt = new Date().toISOString();
				const recordingData = {
					title: item.title.trim() || "Namnlös inspelning",
					author: item.author.trim() || null,
					type: item.type,
					description: null,
					duration: uploadResult.duration || item.duration,
					file_url: uploadResult.url,
					file_size: uploadResult.file.size,
					uploaded_filename:
						uploadResult.wasConverted && uploadResult.originalFile
							? getFilenameWithDate(new File([new Blob()], uploadResult.originalFile.name))
							: getFilenameWithDate(uploadResult.file),
					uploaded_at: uploadedAt,
					uploaded_by: user?.id || null,
					edited_at: uploadedAt,
					edited_by: user?.id || null,
				};

				const { error: dbError } = await supabase.from("recordings").insert(recordingData);

				if (dbError) throw dbError;

				updateItem(item.id, {
					status: "success",
					progress: 100,
				});
				successCount++;
			} catch (error) {
				console.error("Upload error:", error);
				updateItem(item.id, {
					status: "error",
					error: error instanceof Error ? error.message : "Uppladdning misslyckades",
					progress: 0,
				});
				errorCount++;
			}
		}

		isUploading = false;

		if (successCount > 0) {
			toast.success(`${successCount} inspelning${successCount === 1 ? "" : "ar"} uppladdade`);
			dispatch("updated");
		}

		if (errorCount > 0) {
			toast.error(`${errorCount} uppladdning${errorCount === 1 ? "" : "ar"} misslyckades`);
		}

		// Remove successful items after a delay
		if (successCount > 0) {
			setTimeout(() => {
				uploadItems = uploadItems.filter((item) => item.status !== "success");
				if (uploadItems.length === 0) {
					handleClose();
				}
			}, 2000);
		}
	}

	function getItemIcon(status: UploadItem["status"]) {
		switch (status) {
			case "success":
				return Check;
			case "error":
				return AlertCircle;
			default:
				return FileAudio;
		}
	}

	function getItemClass(status: UploadItem["status"]) {
		switch (status) {
			case "success":
				return "has-text-success";
			case "error":
				return "has-text-danger";
			case "uploading":
				return "has-text-info";
			default:
				return "";
		}
	}
</script>

<div class="modal" class:is-active={isOpen}>
	<div
		class="modal-background"
		on:click={handleClose}
		on:keypress={handleClose}
		role="button"
		tabindex="-1"
		aria-label="Close modal"
	></div>
	<div class="modal-card">
		<header class="modal-card-head">
			<p class="modal-card-title">
				<span class="icon">
					<Upload />
				</span>
				<span>Ladda upp flera inspelningar</span>
			</p>
			<button class="delete" aria-label="close" on:click={handleClose} disabled={isUploading}
			></button>
		</header>
		<section class="modal-card-body">
			<!-- File Drop Zone -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="drop-zone"
				class:drag-over={dragOver}
				on:drop={handleDrop}
				on:dragover={handleDragOver}
				on:dragleave={handleDragLeave}
			>
				<input
					bind:this={fileInput}
					type="file"
					accept="audio/*"
					multiple
					on:change={handleFileSelect}
					class="file-input-hidden"
					disabled={isUploading}
				/>
				<div class="has-text-centered">
					<span class="icon is-large has-text-grey">
						<Upload size={48} />
					</span>
					<p class="title is-5">Dra och släpp ljudfiler här</p>
					<p class="subtitle is-6">eller</p>
					<button
						class="button is-primary"
						on:click={() => fileInput.click()}
						disabled={isUploading}
					>
						Välj filer
					</button>
				</div>
			</div>

			<!-- Upload Items List -->
			{#if uploadItems.length > 0}
				<div class="upload-items mt-5">
					<h4 class="title is-6">Filer att ladda upp ({uploadItems.length})</h4>

					{#each uploadItems as item (item.id)}
						<div class="upload-item box">
							<div class="level is-mobile">
								<div class="level-left">
									<div class="level-item">
										<span class="icon {getItemClass(item.status)}">
											<svelte:component this={getItemIcon(item.status)} size={20} />
										</span>
									</div>
									<div class="level-item">
										<strong>{item.file.name}</strong>
										<span class="tag is-small ml-2"
											>{(item.file.size / 1024 / 1024).toFixed(1)} MB</span
										>
									</div>
								</div>
								<div class="level-right">
									{#if item.status === "pending" && !isUploading}
										<button
											class="delete is-small"
											aria-label="Remove"
											on:click={() => removeItem(item.id)}
										></button>
									{:else if item.status === "uploading"}
										<progress class="progress is-small is-info" value={item.progress} max="100">
											{item.progress}%
										</progress>
									{/if}
								</div>
							</div>

							{#if item.status === "error"}
								<p class="help is-danger mt-2">{item.error}</p>
							{/if}

							{#if item.status === "pending"}
								<div class="columns is-mobile mt-2">
									<div class="column">
										<div class="field">
											<!-- svelte-ignore a11y-label-has-associated-control -->
											<label class="label is-small">Titel</label>
											<div class="control">
												<input
													class="input is-small"
													type="text"
													bind:value={item.title}
													placeholder="Titel"
													disabled={isUploading}
												/>
											</div>
										</div>
									</div>
									<div class="column">
										<div class="field">
											<!-- svelte-ignore a11y-label-has-associated-control -->
											<label class="label is-small">Artist</label>
											<div class="control">
												<input
													class="input is-small"
													type="text"
													bind:value={item.author}
													placeholder="Artist"
													disabled={isUploading}
												/>
											</div>
										</div>
									</div>
									<div class="column is-narrow">
										<div class="field">
											<!-- svelte-ignore a11y-label-has-associated-control -->
											<label class="label is-small">Typ</label>
											<div class="control">
												<div class="select is-small">
													<select bind:value={item.type} disabled={isUploading}>
														{#each recordingTypes as type}
															<option value={type.value}>{type.label}</option>
														{/each}
													</select>
												</div>
											</div>
										</div>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>
		<footer class="modal-card-foot">
			<button
				class="button is-primary"
				on:click={startUpload}
				disabled={isUploading || uploadItems.length === 0}
				class:is-loading={isUploading}
			>
				Ladda upp alla
			</button>
			<button class="button" on:click={handleClose} disabled={isUploading}>
				{uploadItems.some((item) => item.status === "success") ? "Stäng" : "Avbryt"}
			</button>
		</footer>
	</div>
</div>

<style>
	.modal-card {
		width: 90%;
		max-width: 900px;
		max-height: 90vh;
	}

	.modal-card-body {
		max-height: calc(90vh - 200px);
		overflow-y: auto;
	}

	.drop-zone {
		border: 2px dashed #dbdbdb;
		border-radius: 4px;
		padding: 3rem;
		text-align: center;
		transition: all 0.2s;
		cursor: pointer;
		position: relative;
	}

	.drop-zone:hover {
		border-color: #3273dc;
		background-color: #f5f5f5;
	}

	.drop-zone.drag-over {
		border-color: #3273dc;
		background-color: #e8f0fe;
		transform: scale(1.02);
	}

	.file-input-hidden {
		position: absolute;
		width: 0;
		height: 0;
		opacity: 0;
		pointer-events: none;
	}

	.upload-item {
		margin-bottom: 1rem;
		position: relative;
	}

	.upload-item:last-child {
		margin-bottom: 0;
	}

	.upload-items {
		max-height: 400px;
		overflow-y: auto;
	}

	.progress {
		width: 100px;
	}
</style>
