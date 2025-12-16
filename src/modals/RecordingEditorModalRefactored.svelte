<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { Save, Check, Trash2, X } from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import type { Recording } from "@/api/supabase/types";
	import {
		updateRecording,
		deleteRecording,
		markRecordingAsOK,
		markRecordingAsNotOK,
		deleteRecordingCover,
		deleteRecordingCaptions,
		uploadAudioFile,
		uploadCoverImage,
		uploadCaptionsFile,
		trimAudioFile,
		formatFileSize,
	} from "@/api";
	import AudioPlayer from "@/components/recording/AudioPlayer.svelte";
	import RecordingForm from "@/components/recording/RecordingForm.svelte";
	import FileUploadSection from "@/components/recording/FileUploadSection.svelte";
	import RecordingMetadata from "@/components/recording/RecordingMetadata.svelte";

	export let recording: Recording | null = null;
	export let isOpen = false;

	const dispatch = createEventDispatcher();

	// Form state
	let title = "";
	let author = "";
	let description = "";
	let type = "unknown";
	let linkOutUrl = "";
	let coverUrl: string | null = null;
	let captionsUrl: string | null = null;

	// File state
	let selectedAudioFile: File | null = null;
	let selectedCoverFile: File | null = null;
	let selectedCaptionsFile: File | null = null;

	// Loading states
	let saving = false;
	let uploading = false;
	let uploadingCover = false;
	let uploadingCaptions = false;

	// Load recording data when opened
	$: if (recording && isOpen) {
		loadFormData();
	}

	function loadFormData() {
		if (!recording) return;

		title = recording.title || "";
		author = recording.author || "";
		description = recording.description || "";
		type = recording.type || "unknown";
		linkOutUrl = recording.link_out_url || "";
		coverUrl = recording.cover_url || null;
		captionsUrl = recording.captions_url || null;
	}

	function resetForm() {
		title = "";
		author = "";
		description = "";
		type = "unknown";
		linkOutUrl = "";
		coverUrl = null;
		captionsUrl = null;
		selectedAudioFile = null;
		selectedCoverFile = null;
		selectedCaptionsFile = null;
		saving = false;
		uploading = false;
		uploadingCover = false;
		uploadingCaptions = false;
	}

	function closeModal() {
		isOpen = false;
		resetForm();
		dispatch("close");
	}

	async function handleSave() {
		if (!recording) return;

		saving = true;
		try {
			const updateData = {
				title: title.trim(),
				author: author.trim() || null,
				description: description.trim() || null,
				type,
				link_out_url: linkOutUrl.trim() || null,
			};

			const { data, error } = await updateRecording(recording.id, updateData);

			if (error) throw error;

			if (data) {
				recording = data;
				const changedType = updateData.type !== recording.type;
				dispatch("updated", { recording: data, changedType });
				toast.success("Ändringar sparade");
			}
		} catch (error) {
			console.error("Save error:", error);
			toast.error("Kunde inte spara ändringar");
		} finally {
			saving = false;
		}
	}

	async function handleAudioUpload(event: CustomEvent<{ file: File }>) {
		if (!recording) return;

		uploading = true;
		selectedAudioFile = event.detail.file;

		try {
			const uploadResult = await uploadAudioFile({
				file: selectedAudioFile,
				bucket: "recordings",
				folder: `audio/${recording.id}`,
				showProgress: true,
				autoConvert: true,
				maxSizeMB: 50,
			});

			const { data, error } = await updateRecording(recording.id, {
				file_url: uploadResult.url,
				file_size: uploadResult.file.size,
				duration: uploadResult.duration,
			});

			if (error) throw error;

			if (data) {
				recording = data;
				selectedAudioFile = null;
				dispatch("updated", { recording: data });
				toast.success("Ljudfil uppladdad och ersatt");
			}
		} catch (error) {
			console.error("Audio upload error:", error);
			toast.error("Kunde inte ladda upp ljudfil");
		} finally {
			uploading = false;
		}
	}

	async function handleCoverUpload(event: CustomEvent<{ file: File }>) {
		if (!recording) return;

		uploadingCover = true;
		selectedCoverFile = event.detail.file;

		try {
			const url = await uploadCoverImage(selectedCoverFile, "recordings", "covers");

			const { data, error } = await updateRecording(recording.id, {
				cover_url: url,
			});

			if (error) throw error;

			if (data) {
				recording = data;
				coverUrl = url;
				selectedCoverFile = null;
				dispatch("updated", { recording: data });
				toast.success("Omslagsbild uppladdad");
			}
		} catch (error) {
			console.error("Cover upload error:", error);
			toast.error("Kunde inte ladda upp omslagsbild");
		} finally {
			uploadingCover = false;
		}
	}

	async function handleCaptionsUpload(event: CustomEvent<{ file: File }>) {
		if (!recording) return;

		uploadingCaptions = true;
		selectedCaptionsFile = event.detail.file;

		try {
			const { url, error: uploadError } = await uploadCaptionsFile(
				selectedCaptionsFile,
				recording.id
			);

			if (uploadError) throw uploadError;

			const { data, error } = await updateRecording(recording.id, {
				captions_url: url,
			});

			if (error) throw error;

			if (data) {
				recording = data;
				captionsUrl = url;
				selectedCaptionsFile = null;
				dispatch("updated", { recording: data });
				toast.success("Textfil uppladdad");
			}
		} catch (error) {
			console.error("Captions upload error:", error);
			toast.error("Kunde inte ladda upp textfil");
		} finally {
			uploadingCaptions = false;
		}
	}

	async function handleDeleteCover() {
		if (!recording) return;

		try {
			const { error } = await deleteRecordingCover(recording);
			if (error) throw error;

			coverUrl = null;
			toast.success("Omslagsbild borttagen");
			dispatch("updated", { recording: { ...recording, cover_url: null } });
		} catch (error) {
			console.error("Delete cover error:", error);
			toast.error("Kunde inte ta bort omslagsbild");
		}
	}

	async function handleDeleteCaptions() {
		if (!recording) return;

		try {
			const { error } = await deleteRecordingCaptions(recording);
			if (error) throw error;

			captionsUrl = null;
			toast.success("Textfil borttagen");
			dispatch("updated", { recording: { ...recording, captions_url: null } });
		} catch (error) {
			console.error("Delete captions error:", error);
			toast.error("Kunde inte ta bort textfil");
		}
	}

	async function handleMarkAsOK() {
		if (!recording) return;

		try {
			const { data, error } = await markRecordingAsOK(recording.id);
			if (error) throw error;

			if (data) {
				recording = data;
				dispatch("updated", {
					recording: data,
					changedStatus: true,
					newStatus: "approved",
				});
				toast.success("Inspelning godkänd");
			}
		} catch (error) {
			console.error("Mark as OK error:", error);
			toast.error("Kunde inte godkänna inspelning");
		}
	}

	async function handleMarkAsNotOK() {
		if (!recording) return;

		try {
			const { data, error } = await markRecordingAsNotOK(recording.id);
			if (error) throw error;

			if (data) {
				recording = data;
				dispatch("updated", {
					recording: data,
					changedStatus: true,
					newStatus: "pending",
				});
				toast.success("Godkännande borttaget");
			}
		} catch (error) {
			console.error("Mark as not OK error:", error);
			toast.error("Kunde inte ta bort godkännande");
		}
	}

	async function handleDelete() {
		if (!recording) return;

		if (
			!confirm("Är du säker på att du vill ta bort denna inspelning? Detta går inte att ångra.")
		) {
			return;
		}

		try {
			const { error } = await deleteRecording(recording.id);
			if (error) throw error;

			dispatch("deleted", { id: recording.id });
			toast.success("Inspelning borttagen");
			closeModal();
		} catch (error) {
			console.error("Delete error:", error);
			toast.error("Kunde inte ta bort inspelning");
		}
	}

	async function handleTrim(event: CustomEvent<{ start: number; end: number }>) {
		if (!recording) return;

		try {
			const blob = await trimAudioFile(recording.file_url, event.detail.start, event.detail.end);
			const fileName = `trimmed_${Date.now()}.wav`;
			const file = new File([blob], fileName, { type: "audio/wav" });

			// Upload the trimmed file
			selectedAudioFile = file;
			await handleAudioUpload({ detail: { file } } as CustomEvent<{ file: File }>);

			toast.success("Ljudfil trimmad och uppladdad");
		} catch (error) {
			console.error("Trim error:", error);
			toast.error("Kunde inte trimma ljudfil");
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Escape" && isOpen && !saving && !uploading) {
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
			on:keypress={closeModal}
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
					<!-- Audio Player -->
					{#if recording.file_url}
						<div class="box mb-4">
							<h4 class="title is-6 mb-3">Ljudspelare</h4>
							<AudioPlayer
								audioUrl={recording.file_url}
								enableTrimming={true}
								on:trim={handleTrim}
							/>
						</div>
					{/if}

					<div class="columns">
						<!-- Left column: Form -->
						<div class="column is-8">
							<h3 class="title is-5 mb-4">Redigera information</h3>

							<RecordingForm
								bind:title
								bind:author
								bind:description
								bind:type
								bind:linkOutUrl
								disabled={saving}
								on:save={handleSave}
							/>

							<FileUploadSection
								{coverUrl}
								{captionsUrl}
								{selectedAudioFile}
								{selectedCoverFile}
								{selectedCaptionsFile}
								{uploading}
								{uploadingCover}
								{uploadingCaptions}
								on:audioSelect={handleAudioUpload}
								on:coverSelect={handleCoverUpload}
								on:captionsSelect={handleCaptionsUpload}
								on:uploadAudio={handleAudioUpload}
								on:uploadCover={handleCoverUpload}
								on:uploadCaptions={handleCaptionsUpload}
								on:deleteCover={handleDeleteCover}
								on:deleteCaptions={handleDeleteCaptions}
								on:error={(e) => toast.error(e.detail.message)}
							/>
						</div>

						<!-- Right column: Metadata -->
						<div class="column is-4">
							<RecordingMetadata {recording} {coverUrl}>
								<div slot="status-actions" class="buttons">
									{#if recording.okey_at === null}
										<button
											class="button is-success is-small"
											on:click={handleMarkAsOK}
											type="button"
										>
											<span class="icon">
												<Check />
											</span>
											<span>Godkänn</span>
										</button>
									{:else}
										<button
											class="button is-warning is-small"
											on:click={handleMarkAsNotOK}
											type="button"
										>
											<span>Ta bort godkännande</span>
										</button>
									{/if}
								</div>
								<p class="help">
									{#if recording.okey_at === null}
										Godkänn inspelningen för att den ska kunna spelas i radion
									{:else}
										Inspelningen är godkänd och kan spelas i radion
									{/if}
								</p>
							</RecordingMetadata>

							{#if recording.okey_at === null}
								<div class="field mt-4">
									<button
										class="button is-danger is-outlined is-fullwidth"
										on:click={handleDelete}
										type="button"
									>
										<span class="icon">
											<Trash2 size={16} />
										</span>
										<span>Ta bort inspelning</span>
									</button>
									<p class="help">Detta går inte att ångra</p>
								</div>
							{/if}
						</div>
					</div>

					<hr />

					<div class="level">
						<div class="level-left" />
						<div class="level-right">
							<div class="level-item">
								<button
									class="button is-primary"
									on:click={handleSave}
									disabled={saving}
									class:is-loading={saving}
									type="button"
								>
									<span class="icon">
										<Save />
									</span>
									<span>Spara ändringar</span>
								</button>
							</div>
							<div class="level-item">
								<button class="button" on:click={closeModal} type="button"> Stäng </button>
							</div>
						</div>
					</div>
				{/if}
			</section>
		</div>
	</div>
{/if}

<style>
	.modal-card-wide {
		width: 95%;
		max-width: 1400px;
	}
</style>
