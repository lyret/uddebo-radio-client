<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import {
		Save,
		Upload,
		Check,
		AlertCircle,
		CheckCircle,
		Download,
		Trash2,
		Image,
		FileText,
	} from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import type { Recording, RecordingType, RecordingUpdate } from "@/api";
	import { supabase } from "@/api";
	import { getAllSwedishRecordingTypes } from "@/api/lang";

	export let recording: Recording | null = null;
	export let isOpen = false;

	const dispatch = createEventDispatcher();

	let saving = false;
	let uploading = false;
	let uploadingCover = false;
	let uploadingCaptions = false;

	// File inputs
	let audioFileInput: HTMLInputElement;
	let coverFileInput: HTMLInputElement;
	let captionsFileInput: HTMLInputElement;

	// Selected files
	let selectedAudioFile: File | null = null;
	let selectedCoverFile: File | null = null;
	let selectedCaptionsFile: File | null = null;

	// Form fields
	let title = "";
	let author = "";
	let description = "";
	let type: RecordingType = "unknown";
	let link_out_url = "";
	let cover_url = "";
	let captions_url = "";

	// All possible recording types with Swedish labels
	const recordingTypes = getAllSwedishRecordingTypes();

	// Load form data when modal opens
	$: if (isOpen && recording) {
		loadFormData();
	}

	function loadFormData() {
		if (!recording) return;

		title = recording.title || "";
		author = recording.author || "";
		description = recording.description || "";
		type = recording.type || "unknown";
		link_out_url = recording.link_out_url || "";
		cover_url = recording.cover_url || "";
		captions_url = recording.captions_url || "";
	}

	function resetForm() {
		title = "";
		author = "";
		description = "";
		type = "unknown";
		link_out_url = "";
		cover_url = "";
		captions_url = "";
		selectedAudioFile = null;
		selectedCoverFile = null;
		selectedCaptionsFile = null;
		if (audioFileInput) audioFileInput.value = "";
		if (coverFileInput) coverFileInput.value = "";
		if (captionsFileInput) captionsFileInput.value = "";
	}

	function closeModal() {
		resetForm();
		isOpen = false;
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
				title,
				author,
				description,
				type,
				link_out_url,
				cover_url,
				captions_url,
				edited_at: new Date().toISOString(),
				edited_by: user?.id || null,
			};

			const { error } = await supabase.from("recordings").update(updateData).eq("id", recording.id);

			if (error) throw error;

			toast.success("Inspelningen uppdaterades");
			dispatch("updated", { changedType: recording.type !== type });
			closeModal();
		} catch (error) {
			toast.error("Kunde inte uppdatera inspelningen");
			console.error(error);
		} finally {
			saving = false;
		}
	}

	async function handleAudioFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			selectedAudioFile = input.files[0];
			// Validate file type
			if (!selectedAudioFile.type.startsWith("audio/")) {
				toast.error("Vänligen välj en ljudfil");
				selectedAudioFile = null;
				return;
			}
		}
	}

	async function handleCoverFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			selectedCoverFile = input.files[0];
			// Validate file type
			if (!selectedCoverFile.type.startsWith("image/")) {
				toast.error("Vänligen välj en bildfil");
				selectedCoverFile = null;
				return;
			}
		}
	}

	async function handleCaptionsFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			selectedCaptionsFile = input.files[0];
			// Validate file type (JSON or VTT)
			const validTypes = ["application/json", "text/vtt"];
			const fileExt = selectedCaptionsFile.name.split(".").pop()?.toLowerCase();

			if (
				!validTypes.includes(selectedCaptionsFile.type) &&
				!["json", "vtt"].includes(fileExt || "")
			) {
				toast.error("Vänligen välj en JSON- eller VTT-fil för undertexter");
				selectedCaptionsFile = null;
				return;
			}
		}
	}

	async function uploadAudioFile() {
		if (!selectedAudioFile || !recording) return;

		try {
			uploading = true;

			// Delete old file first (if exists)
			const oldFileName = recording.file_url.split("/").pop();
			if (oldFileName) {
				await supabase.storage.from("recordings").remove([oldFileName]);
			}

			// Upload new file with timestamp for uniqueness
			const fileExt = selectedAudioFile.name.split(".").pop();
			const timestamp = Date.now();
			const fileName = `${recording.id}_${timestamp}.${fileExt}`;

			const { error: uploadError } = await supabase.storage
				.from("recordings")
				.upload(fileName, selectedAudioFile);

			if (uploadError) throw uploadError;

			// Get public URL
			const { data: urlData } = supabase.storage.from("recordings").getPublicUrl(fileName);

			// Get duration of new file
			const audio = new Audio();
			audio.src = URL.createObjectURL(selectedAudioFile);

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
					file_size: selectedAudioFile.size,
					duration: duration,
					edited_at: new Date().toISOString(),
					edited_by: user?.id || null,
				})
				.eq("id", recording.id);

			if (dbError) throw dbError;

			toast.success("Ljudfilen har ersatts");
			selectedAudioFile = null;
			audioFileInput.value = "";
			dispatch("updated");
		} catch (error) {
			toast.error("Kunde inte ladda upp ny ljudfil");
			console.error(error);
		} finally {
			uploading = false;
		}
	}

	async function uploadCoverImage() {
		if (!selectedCoverFile || !recording) return;

		try {
			uploadingCover = true;

			// Upload cover image with timestamp for uniqueness
			const fileExt = selectedCoverFile.name.split(".").pop();
			const timestamp = Date.now();
			const fileName = `${recording.id}_${timestamp}.${fileExt}`;

			// Delete old cover if exists
			if (recording.cover_url && recording.cover_url.includes("supabase")) {
				const oldFileName = recording.cover_url.split("/").pop();
				if (oldFileName) {
					await supabase.storage.from("cover_images").remove([oldFileName]);
				}
			}

			const { error: uploadError } = await supabase.storage
				.from("cover_images")
				.upload(fileName, selectedCoverFile);

			if (uploadError) throw uploadError;

			// Get public URL
			const { data: urlData } = supabase.storage.from("cover_images").getPublicUrl(fileName);

			// Update the form field
			cover_url = urlData.publicUrl;

			// Save the cover URL to database
			const {
				data: { user },
			} = await supabase.auth.getUser();

			const { error: dbError } = await supabase
				.from("recordings")
				.update({
					cover_url: urlData.publicUrl,
					edited_at: new Date().toISOString(),
					edited_by: user?.id || null,
				})
				.eq("id", recording.id);

			if (dbError) throw dbError;

			// Update local recording object
			recording.cover_url = urlData.publicUrl;

			toast.success("Omslagsbilden har laddats upp och sparats");
			selectedCoverFile = null;
			coverFileInput.value = "";
			dispatch("updated");
		} catch (error) {
			toast.error("Kunde inte ladda upp omslagsbilden");
			console.error(error);
		} finally {
			uploadingCover = false;
		}
	}

	async function uploadCaptionsFile() {
		if (!selectedCaptionsFile || !recording) return;

		try {
			uploadingCaptions = true;

			// Upload captions file with timestamp for uniqueness
			const fileExt = selectedCaptionsFile.name.split(".").pop();
			const timestamp = Date.now();
			const fileName = `${recording.id}_${timestamp}.${fileExt}`;

			// Delete old captions if exists
			if (recording.captions_url && recording.captions_url.includes("supabase")) {
				const oldFileName = recording.captions_url.split("/").pop();
				if (oldFileName) {
					await supabase.storage.from("captions").remove([oldFileName]);
				}
			}

			const { error: uploadError } = await supabase.storage
				.from("captions")
				.upload(fileName, selectedCaptionsFile, {
					contentType: selectedCaptionsFile.type || "application/json",
				});

			if (uploadError) throw uploadError;

			// Get public URL
			const { data: urlData } = supabase.storage.from("captions").getPublicUrl(fileName);

			// Update the form field
			captions_url = urlData.publicUrl;

			// Save the captions URL to database
			const {
				data: { user },
			} = await supabase.auth.getUser();

			const { error: dbError } = await supabase
				.from("recordings")
				.update({
					captions_url: urlData.publicUrl,
					edited_at: new Date().toISOString(),
					edited_by: user?.id || null,
				})
				.eq("id", recording.id);

			if (dbError) throw dbError;

			// Update local recording object
			recording.captions_url = urlData.publicUrl;

			toast.success("Undertextfilen har laddats upp och sparats");
			selectedCaptionsFile = null;
			captionsFileInput.value = "";
			dispatch("updated");
		} catch (error) {
			toast.error("Kunde inte ladda upp undertextfilen");
			console.error(error);
		} finally {
			uploadingCaptions = false;
		}
	}

	async function deleteCoverImage() {
		if (!recording || !recording.cover_url) return;

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			// Delete from storage if it's a Supabase URL
			if (recording.cover_url.includes("supabase")) {
				const fileName = recording.cover_url.split("/").pop();
				if (fileName) {
					await supabase.storage.from("cover_images").remove([fileName]);
				}
			}

			// Clear from database
			const { error } = await supabase
				.from("recordings")
				.update({
					cover_url: null,
					edited_at: new Date().toISOString(),
					edited_by: user?.id || null,
				})
				.eq("id", recording.id);

			if (error) throw error;

			// Update local state
			recording.cover_url = null;
			cover_url = "";

			toast.success("Omslagsbilden har tagits bort");
			dispatch("updated");
		} catch (error) {
			toast.error("Kunde inte ta bort omslagsbilden");
			console.error(error);
		}
	}

	async function deleteCaptionsFile() {
		if (!recording || !recording.captions_url) return;

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			// Delete from storage if it's a Supabase URL
			if (recording.captions_url.includes("supabase")) {
				const fileName = recording.captions_url.split("/").pop();
				if (fileName) {
					await supabase.storage.from("captions").remove([fileName]);
				}
			}

			// Clear from database
			const { error } = await supabase
				.from("recordings")
				.update({
					captions_url: null,
					edited_at: new Date().toISOString(),
					edited_by: user?.id || null,
				})
				.eq("id", recording.id);

			if (error) throw error;

			// Update local state
			recording.captions_url = null;
			captions_url = "";

			toast.success("Undertextfilen har tagits bort");
			dispatch("updated");
		} catch (error) {
			toast.error("Kunde inte ta bort undertextfilen");
			console.error(error);
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
			toast.success("Inspelningen markerad som OK");
			dispatch("updated", { changedStatus: true, newStatus: "ok" });
		} catch (error) {
			toast.error("Kunde inte markera inspelningen som OK");
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
			toast.success("Inspelningen markerad som ej OK");
			dispatch("updated", { changedStatus: true, newStatus: "not_ok" });
		} catch (error) {
			toast.error("Kunde inte markera inspelningen som ej OK");
			console.error(error);
		}
	}

	async function handleDelete() {
		if (!recording) return;

		if (
			!confirm("Är du säker på att du vill ta bort denna inspelning? Denna åtgärd kan inte ångras.")
		)
			return;

		try {
			const { error } = await supabase.from("recordings").delete().eq("id", recording.id);

			if (error) throw error;

			toast.success("Inspelningen har tagits bort");
			dispatch("deleted");
			closeModal();
		} catch (error) {
			toast.error("Kunde inte ta bort inspelningen");
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
					Redigera inspelning
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
							<h3 class="title is-5 mb-4">Inspelningsdetaljer</h3>
							<form on:submit|preventDefault={handleSave}>
								<div class="field">
									<label class="label" for="modal-title">Titel</label>
									<div class="control">
										<input
											id="modal-title"
											class="input"
											type="text"
											bind:value={title}
											placeholder="Inspelningstitel"
										/>
									</div>
								</div>

								<div class="field">
									<label class="label" for="modal-author">Artist</label>
									<div class="control">
										<input
											id="modal-author"
											class="input"
											type="text"
											bind:value={author}
											placeholder="Artistnamn"
										/>
									</div>
								</div>

								<div class="field">
									<label class="label" for="modal-description">Beskrivning</label>
									<div class="control">
										<textarea
											id="modal-description"
											class="textarea"
											bind:value={description}
											placeholder="Detaljerad beskrivning av inspelningen"
											rows="4"
										/>
									</div>
								</div>

								<div class="field">
									<label class="label" for="modal-type">Typ</label>
									<div class="control">
										<div class="select is-fullwidth">
											<select id="modal-type" bind:value={type}>
												{#each recordingTypes as recordingType}
													<option value={recordingType.value}>{recordingType.label}</option>
												{/each}
											</select>
										</div>
									</div>
								</div>

								<div class="field">
									<label class="label" for="modal-link">Extern länk</label>
									<div class="control">
										<input
											id="modal-link"
											class="input"
											type="url"
											bind:value={link_out_url}
											placeholder="https://example.com"
										/>
									</div>
									<p class="help">Valfri extern URL för marknadsföringsändamål</p>
								</div>

								<hr />

								<!-- Cover Image Upload -->
								<div class="field">
									<p class="label">Omslagsbild</p>
									<div class="file has-name is-fullwidth mb-2">
										<label class="file-label">
											<input
												bind:this={coverFileInput}
												class="file-input"
												type="file"
												accept="image/*"
												on:change={handleCoverFileSelect}
											/>
											<span class="file-cta">
												<span class="file-icon">
													<Image />
												</span>
												<span class="file-label">Välj omslagsbild...</span>
											</span>
											<span class="file-name">
												{selectedCoverFile ? selectedCoverFile.name : "Ingen fil vald"}
											</span>
										</label>
									</div>
									{#if selectedCoverFile}
										<button
											class="button is-info is-small"
											type="button"
											on:click={uploadCoverImage}
											disabled={uploadingCover}
										>
											{uploadingCover ? "Laddar upp..." : "Ladda upp omslag"}
										</button>
									{/if}
									{#if cover_url || recording.cover_url}
										<p class="help">
											<a
												class="button is-rounded is-outlined is-info is-small"
												href={cover_url || recording.cover_url}
												target="_blank">Visa nuvarande omslagsbild</a
											>
											<button
												class="button is-rounded is-outlined is-danger is-small ml-2"
												type="button"
												on:click={deleteCoverImage}
											>
												<span class="icon">
													<Trash2 size={14} />
												</span>
												<span>Ta bort</span>
											</button>
										</p>
									{/if}
								</div>

								<!-- Captions File Upload -->
								<div class="field">
									<p class="label">Undertextfil</p>
									<div class="file has-name is-fullwidth mb-2">
										<label class="file-label">
											<input
												bind:this={captionsFileInput}
												class="file-input"
												type="file"
												accept=".json,.vtt,application/json,text/vtt"
												on:change={handleCaptionsFileSelect}
											/>
											<span class="file-cta">
												<span class="file-icon">
													<FileText />
												</span>
												<span class="file-label">Välj undertextfil...</span>
											</span>
											<span class="file-name">
												{selectedCaptionsFile ? selectedCaptionsFile.name : "Ingen fil vald"}
											</span>
										</label>
									</div>
									{#if selectedCaptionsFile}
										<button
											class="button is-info is-small"
											type="button"
											on:click={uploadCaptionsFile}
											disabled={uploadingCaptions}
										>
											{uploadingCaptions ? "Laddar upp..." : "Ladda upp undertexter"}
										</button>
									{/if}
									<p class="help">Accepterar JSON- eller VTT-format</p>
									{#if captions_url || recording.captions_url}
										<p class="help">
											<a
												class="button is-rounded is-outlined is-info is-small"
												href={captions_url || recording.captions_url}
												target="_blank">Visa nuvarande undertextfil</a
											>
											<button
												class="button is-danger is-small is-danger is-rounded is-outlined is-info is-small ml-2"
												type="button"
												on:click={deleteCaptionsFile}
											>
												<span class="icon">
													<Trash2 size={14} />
												</span>
												<span>Ta bort</span>
											</button>
										</p>
									{/if}
								</div>

								<!-- Replace Audio File -->
								<div class="field mt-4">
									<p class="label">Ersätt ljudfil</p>
									<div class="file has-name is-fullwidth mb-2">
										<label class="file-label">
											<input
												bind:this={audioFileInput}
												class="file-input"
												type="file"
												accept="audio/*"
												on:change={handleAudioFileSelect}
											/>
											<span class="file-cta">
												<span class="file-icon">
													<Upload />
												</span>
												<span class="file-label">Välj ljudfil...</span>
											</span>
											<span class="file-name">
												{selectedAudioFile ? selectedAudioFile.name : "Ingen fil vald"}
											</span>
										</label>
									</div>
									{#if selectedAudioFile}
										<button
											class="button is-warning is-small is-rounded"
											type="button"
											on:click={uploadAudioFile}
											disabled={uploading}
										>
											{uploading ? "Laddar upp..." : "Ersätt ljudfil"}
										</button>
										<p class="help is-danger mt-1">
											Varning: Detta kommer att permanent ersätta den nuvarande ljudfilen
										</p>
									{/if}
								</div>
							</form>
						</div>

						<!-- Info and status column -->
						<div class="column is-4">
							<div class="box">
								<h4 class="title is-6 mb-3">Filinformation</h4>
								<div class="content is-small">
									<p><strong>Filnamn:</strong> {recording.uploaded_filename}</p>
									<p><strong>Längd:</strong> {formatDuration(recording.duration)}</p>
									<p><strong>Storlek:</strong> {formatFileSize(recording.file_size)}</p>
									<p><strong>Uppladdad:</strong> {formatDateTime(recording.uploaded_at)}</p>
									{#if recording.edited_at && recording.edited_at !== recording.uploaded_at}
										<p><strong>Senast redigerad:</strong> {formatDateTime(recording.edited_at)}</p>
									{/if}
									{#if recording.okey_at}
										<p><strong>Markerad OK:</strong> {formatDateTime(recording.okey_at)}</p>
									{/if}
								</div>

								<!-- Cover Image Display -->
								{#if cover_url || recording.cover_url}
									<div class="field mt-3">
										<p class="label is-size-7">Omslagsbild</p>
										<figure class="image is-square">
											<img src={cover_url || recording.cover_url} alt="Recording cover" />
										</figure>
									</div>
								{/if}

								<!-- Audio preview -->
								<div class="field mt-4">
									<p class="label is-size-7">Förhandsgranska</p>
									<audio controls src={recording.file_url} class="is-fullwidth" />
								</div>

								<!-- Download button -->
								<div class="field mt-3">
									<a
										class="button is-info is-fullwidth is-small"
										href={recording.file_url}
										download={recording.uploaded_filename}
										target="_blank"
									>
										<span class="icon">
											<Download />
										</span>
										<span>Ladda ner ljud</span>
									</a>
								</div>
							</div>

							<div
								class="notification mt-4 is-light"
								class:is-success={recording.okey_at !== null}
								class:is-warning={recording.okey_at === null}
							>
								<h4
									class="title is-6 mb-3 has-text-centered"
									class:is-success={recording.okey_at !== null}
									class:is-warning={recording.okey_at === null}
								>
									{#if recording.okey_at === null}
										<span class="icon">
											<AlertCircle />
										</span>
										<br />
										<span class="has-text-weight-semibold">
											Inspelningen är markerad som EJ OK
										</span>
									{:else}
										<span class="icon">
											<CheckCircle />
										</span>
										<br />
										<span class="has-text-weight-semibold"> Inspelningen är markerad som OK </span>
									{/if}
								</h4>
								<div class="field">
									<div class="buttons">
										{#if recording.okey_at === null}
											<button
												class="button is-success is-fullwidth has-text-left"
												on:click={markAsOK}
											>
												<span class="icon">
													<Check />
												</span>
												<span>Markera som OK</span>
											</button>
										{:else}
											<button
												class="button is-fullwidth is-small is-light is-warning"
												on:click={markAsNotOK}
											>
												<span>Markera som EJ OK</span>
											</button>
										{/if}
									</div>
									<p class="help">
										{#if recording.okey_at === null}
											Denna inspelning kommer inte att visas i spelaren eller vara tillgänglig för
											program
										{:else}
											Denna inspelning är tillgänglig för uppspelning och kan läggas till i program
										{/if}
									</p>
								</div>
								{#if recording.okey_at === null}
									<div class="field">
										<button
											class="button is-danger is-outlined is-fullwidth is-small"
											on:click={handleDelete}
											disabled={saving}
										>
											<span class="icon">
												<Trash2 size={16} />
											</span>
											<span>Ta bort inspelning</span>
										</button>
										<p class="help">
											Denna inspelning har inte markerats som OK och kan tas bort permanent.
										</p>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/if}
				<hr />

				<div class="level">
					<div class="level-left" />
					<div class="level-right">
						<div class="level-item">
							<button
								class="button is-primary"
								on:click={handleSave}
								disabled={saving}
								type="button"
							>
								<span class="icon">
									<Save />
								</span>
								<span>{saving ? "Sparar..." : "Uppdatera inspelning"}</span>
							</button>
						</div>
						<div class="level-item">
							<button class="button" on:click={closeModal} type="button">Avbryt</button>
						</div>
					</div>
				</div>
			</section>
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

	.image.is-square {
		width: 100%;
		overflow: hidden;
		margin: 0;
	}
</style>
