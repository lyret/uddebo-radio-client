<script lang="ts">
	import { createEventDispatcher, onMount } from "svelte";
	import { Check, Trash2, X } from "lucide-svelte";
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
	import RecordingInformationForm from "@/components/recording/RecordingInformationForm.svelte";
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

	// Loading states
	let saving = false;
	let uploading = false;
	let uploadingCover = false;
	let uploadingCaptions = false;

	// Key to force AudioPlayer remount
	let audioPlayerKey = 0;

	// Form ref
	let formComponent: RecordingInformationForm;
	let audioPlayerComponent: AudioPlayer;

	// Load recording data when opened
	$: if (recording && isOpen) {
		loadFormData();
	}

	// Initialize form when component is mounted and recording exists
	onMount(() => {
		if (recording && formComponent) {
			loadFormData();
		}
	});

	function loadFormData() {
		if (!recording) return;

		title = recording.title || "";
		author = recording.author || "";
		description = recording.description || "";
		type = recording.type || "unknown";
		linkOutUrl = recording.link_out_url || "";
		coverUrl = recording.cover_url || null;
		captionsUrl = recording.captions_url || null;

		// Initialize the form component with current values
		if (formComponent) {
			formComponent.initialize({
				title,
				author,
				description,
				type,
				linkOutUrl,
				coverUrl,
				captionsUrl,
			});
		}
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
		saving = false;
		uploading = false;
		uploadingCover = false;
		uploadingCaptions = false;
	}

	function closeModal() {
		// Stop audio before closing
		if (audioPlayerComponent) {
			audioPlayerComponent.stop();
		}
		isOpen = false;
		resetForm();
		dispatch("close");
	}

	async function handleSave(event: CustomEvent) {
		if (!recording) return;

		saving = true;
		try {
			const formData = event.detail;
			let finalCoverUrl = coverUrl;
			let finalCaptionsUrl = captionsUrl;

			// Upload cover image if selected
			if (formData.coverFile) {
				uploadingCover = true;
				try {
					finalCoverUrl = await uploadCoverImage(formData.coverFile, "cover_images", "");
				} catch (error) {
					console.error("Cover upload error:", error);
					toast.error("Kunde inte ladda upp omslagsbild");
					return;
				} finally {
					uploadingCover = false;
				}
			}

			// Upload captions file if selected
			if (formData.captionsFile) {
				uploadingCaptions = true;
				try {
					const { url, error: uploadError } = await uploadCaptionsFile(
						formData.captionsFile,
						recording.id
					);
					if (uploadError) throw uploadError;
					finalCaptionsUrl = url;
				} catch (error) {
					console.error("Captions upload error:", error);
					toast.error("Kunde inte ladda upp textfil");
					return;
				} finally {
					uploadingCaptions = false;
				}
			}

			const updateData = {
				title: formData.title.trim(),
				author: formData.author.trim() || null,
				description: formData.description.trim() || null,
				type: formData.type,
				link_out_url: formData.link_out_url?.trim() || null,
				cover_url: finalCoverUrl || null,
				captions_url: finalCaptionsUrl || null,
			};

			const { data, error } = await updateRecording(recording.id, updateData);

			if (error) throw error;

			if (data) {
				recording = data;
				coverUrl = data.cover_url || null;
				captionsUrl = data.captions_url || null;
				const changedType = updateData.type !== recording.type;
				dispatch("updated", { recording: data, changedType });
				toast.success("Ändringar sparade");

				// Update form's initial values after successful save
				if (formComponent) {
					formComponent.initialize({
						title: data.title || "",
						author: data.author || "",
						description: data.description || "",
						type: data.type || "unknown",
						linkOutUrl: data.link_out_url || "",
						coverUrl: data.cover_url || null,
						captionsUrl: data.captions_url || null,
					});
				}
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
				folder: "",
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
				// Force AudioPlayer to remount with new audio URL
				audioPlayerKey++;
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

	async function handleReplace(event: CustomEvent<{ file: File }>) {
		await handleAudioUpload(event);
	}

	async function handleDeleteCover() {
		if (!recording) return;

		try {
			const { error } = await deleteRecordingCover(recording);
			if (error) throw error;

			coverUrl = null;
			if (formComponent) {
				formComponent.updateCoverUrl(null);
			}
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
			if (formComponent) {
				formComponent.updateCaptionsUrl(null);
			}
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
				{#if recording && isOpen}
					<!-- Audio Player -->
					{#if recording.file_url}
						<div class="box mb-4">
							<h4 class="title is-6 mb-3">Ljudspelare</h4>
							{#key audioPlayerKey}
								<AudioPlayer
									bind:this={audioPlayerComponent}
									audioUrl={recording.file_url}
									enableTrimming={true}
									enableReplacement={true}
									on:trim={handleTrim}
									on:replace={handleReplace}
								/>
							{/key}
						</div>
					{/if}

					<div class="columns">
						<!-- Left column: Form -->
						<div class="column is-8">
							<RecordingInformationForm
								bind:this={formComponent}
								bind:title
								bind:author
								bind:description
								bind:type
								bind:linkOutUrl
								bind:coverUrl
								bind:captionsUrl
								disabled={saving || uploading || uploadingCover || uploadingCaptions}
								{saving}
								{uploadingCover}
								{uploadingCaptions}
								on:save={handleSave}
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
											class="button is-success is-small is-dark mt-2 is-fullwidth has-text-left"
											on:click={handleMarkAsOK}
											type="button"
										>
											<span class="icon">
												<Check />
											</span>
											<span>Godkänn inspelningen</span>
										</button>
										<button
											class="button is-danger is-outlined is-fullwidth is-small mt-4"
											on:click={handleDelete}
											type="button"
										>
											<span class="icon">
												<Trash2 size={16} />
											</span>
											<span>Ta bort inspelning</span>
										</button>
										<p class="help">Detta går inte att ångra</p>
									{:else}
										<button
											class="button is-success is-small is-light mt-2 is-fullwidth has-text-left"
											on:click={handleMarkAsNotOK}
											type="button"
										>
											<span>Ta bort godkännande</span>
										</button>
									{/if}
								</div>
							</RecordingMetadata>
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
