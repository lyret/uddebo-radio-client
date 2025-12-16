<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from "svelte";
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
		Scissors,
	} from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import type { Recording, RecordingType, RecordingUpdate } from "@/api";
	import {
		supabase,
		uploadAudioFile,
		uploadCoverImage,
		deleteStorageFile,
		needsAudioConversion,
		getAudioFormatDescription,
	} from "@/api";
	import { getAllSwedishRecordingTypes } from "@/api/lang";
	import WaveSurfer from "wavesurfer.js";
	import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";

	export let recording: Recording | null = null;
	export let isOpen = false;
	export let audioElement: HTMLAudioElement | null = null;
	export let isPlaying = false;

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

	// WaveSurfer instance
	let wavesurfer: WaveSurfer | null = null;
	let waveformContainer: HTMLDivElement;
	let activeRegion: any = null;
	let trimStart = 0;
	let trimEnd = 0;
	let showTrimControls = false;
	let localIsPlaying = false;

	// Load form data when modal opens
	$: if (isOpen && recording) {
		loadFormData();
	}

	// Initialize waveform when container is ready
	$: if (waveformContainer && recording?.file_url && isOpen) {
		initializeWaveform();
	}

	// Sync with external audio element
	$: if (wavesurfer && audioElement && isOpen) {
		syncWithAudioElement();
	}

	// Cleanup on destroy
	onDestroy(() => {
		if (wavesurfer) {
			wavesurfer.destroy();
			wavesurfer = null;
		}
		if (audioListenerCleanup) {
			audioListenerCleanup();
			audioListenerCleanup = null;
		}
	});

	function loadFormData() {
		if (!recording) return;

		title = recording.title || "";
		author = recording.author || "";
		description = recording.description || "";
		type = recording.type || "unknown";
		link_out_url = recording.link_out_url || "";
		cover_url = recording.cover_url || "";
		captions_url = recording.captions_url || "";

		// Initialize waveform after form data is loaded
		if (recording.file_url) {
			initializeWaveform();
		}
	}

	// Set up audio element listeners when we have both audio element and recording
	function setupAudioListeners() {
		if (!audioElement || !wavesurfer || !recording || !isOpen) return;

		const handleTimeUpdate = () => {
			if (
				audioElement &&
				wavesurfer &&
				audioElement.src === recording.file_url &&
				!wavesurfer.isPlaying()
			) {
				const progress = audioElement.currentTime / audioElement.duration;
				if (!isNaN(progress)) {
					wavesurfer.seekTo(progress);
				}
			}
		};

		const handlePlay = () => {
			if (
				audioElement &&
				wavesurfer &&
				audioElement.src === recording.file_url &&
				!wavesurfer.isPlaying()
			) {
				const seekTo = audioElement.currentTime / audioElement.duration;
				if (!isNaN(seekTo)) {
					wavesurfer.seekTo(seekTo);
				}
				wavesurfer.play();
			}
		};

		const handlePause = () => {
			if (
				audioElement &&
				wavesurfer &&
				audioElement.src === recording.file_url &&
				wavesurfer.isPlaying()
			) {
				wavesurfer.pause();
			}
		};

		audioElement.addEventListener("timeupdate", handleTimeUpdate);
		audioElement.addEventListener("play", handlePlay);
		audioElement.addEventListener("pause", handlePause);

		// Return cleanup function
		return () => {
			if (audioElement) {
				audioElement.removeEventListener("timeupdate", handleTimeUpdate);
				audioElement.removeEventListener("play", handlePlay);
				audioElement.removeEventListener("pause", handlePause);
			}
		};
	}

	// Reactive statement to setup/cleanup audio listeners
	let audioListenerCleanup: (() => void) | null = null;
	$: {
		// Clean up previous listeners
		if (audioListenerCleanup) {
			audioListenerCleanup();
			audioListenerCleanup = null;
		}
		// Set up new listeners if conditions are met
		if (audioElement && wavesurfer && recording && isOpen) {
			audioListenerCleanup = setupAudioListeners();
		}
	}

	async function initializeWaveform() {
		if (!recording?.file_url || !waveformContainer) return;

		// Destroy existing instance if any
		if (wavesurfer) {
			wavesurfer.destroy();
			wavesurfer = null;
		}

		// Create new WaveSurfer instance
		wavesurfer = WaveSurfer.create({
			container: waveformContainer,
			waveColor: "#4F4A85",
			progressColor: "#383351",
			url: recording.file_url,
			height: 100,
			normalize: true,
			backend: "WebAudio",
		});

		// Initialize regions plugin for trimming
		const regions = wavesurfer.registerPlugin(RegionsPlugin.create());

		// When waveform is ready, set up the initial region if needed
		wavesurfer.on("ready", () => {
			const duration = wavesurfer?.getDuration() || 0;
			trimEnd = duration;

			// Create initial region for the full audio
			activeRegion = regions.addRegion({
				start: 0,
				end: duration,
				color: "rgba(79, 74, 133, 0.3)",
				drag: true,
				resize: true,
			});

			// Update trim values when region is modified
			activeRegion.on("update", () => {
				trimStart = activeRegion.start;
				trimEnd = activeRegion.end;
			});

			// Sync with audio element if playing
			if (audioElement && isPlaying && audioElement.src === recording.file_url) {
				syncWithAudioElement();
			}
		});

		// Update play state and sync with audio element
		wavesurfer.on("play", () => {
			localIsPlaying = true;
			// If audio element exists and is not playing the same file, pause it
			if (audioElement && audioElement.src !== recording.file_url) {
				audioElement.pause();
			}
		});

		wavesurfer.on("pause", () => {
			localIsPlaying = false;
		});

		wavesurfer.on("finish", () => {
			localIsPlaying = false;
		});

		// Sync wavesurfer position with audio element when seeking
		wavesurfer.on("seeking", (progress) => {
			if (audioElement && audioElement.src === recording.file_url && localIsPlaying) {
				audioElement.currentTime = progress * wavesurfer.getDuration();
			}
		});
	}

	function syncWithAudioElement() {
		if (!wavesurfer || !audioElement || !recording) return;

		// If audio element is playing this recording, sync wavesurfer
		if (audioElement.src === recording.file_url) {
			if (isPlaying && !localIsPlaying) {
				// Seek to current position and start playing
				const currentTime = audioElement.currentTime;
				const duration = audioElement.duration;
				if (!isNaN(currentTime) && !isNaN(duration) && duration > 0) {
					wavesurfer.seekTo(currentTime / duration);
					// Wait for seek to complete before playing
					setTimeout(() => {
						wavesurfer.play();
					}, 100);
				}
			} else if (!isPlaying && localIsPlaying) {
				// Pause wavesurfer
				wavesurfer.pause();
			}
		}
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
		trimStart = 0;
		trimEnd = 0;
		showTrimControls = false;
		activeRegion = null;
		localIsPlaying = false;
	}

	function closeModal() {
		// Always stop audio when closing modal
		if (audioElement && !audioElement.paused) {
			audioElement.pause();
		}

		// Stop wavesurfer playback if it's playing
		if (wavesurfer && localIsPlaying) {
			wavesurfer.pause();
		}

		if (wavesurfer) {
			wavesurfer.destroy();
			wavesurfer = null;
		}
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

			// Check if conversion is needed and notify user
			if (needsAudioConversion(selectedAudioFile)) {
				toast.info(
					`${getAudioFormatDescription(selectedAudioFile)}-fil kommer att konverteras till MP3`,
					{
						description: "Detta säkerställer kompatibilitet med alla enheter",
					}
				);
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

	async function uploadAudioFileHandler() {
		if (!selectedAudioFile || !recording) return;

		try {
			uploading = true;

			// Delete old file first (if exists)
			if (recording.file_url) {
				try {
					await deleteStorageFile(recording.file_url, "recordings");
				} catch (error) {
					console.warn("Could not delete old file:", error);
				}
			}

			// Upload new file with automatic conversion if needed
			const uploadResult = await uploadAudioFile({
				file: selectedAudioFile,
				bucket: "recordings",
				folder: `replacements/${recording.id}`,
				showProgress: true,
				autoConvert: true,
				maxSizeMB: 50,
			});

			// Update database with new file info
			const {
				data: { user },
			} = await supabase.auth.getUser();

			const { error: dbError } = await supabase
				.from("recordings")
				.update({
					file_url: uploadResult.url,
					file_size: uploadResult.file.size,
					duration: uploadResult.duration,
					edited_at: new Date().toISOString(),
					edited_by: user?.id || null,
				})
				.eq("id", recording.id);

			if (dbError) throw dbError;

			if (uploadResult.wasConverted) {
				toast.success("Ljudfilen har ersatts och konverterats till MP3");
			} else {
				toast.success("Ljudfilen har ersatts");
			}

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

	async function uploadCoverImageHandler() {
		if (!selectedCoverFile || !recording) return;

		try {
			uploadingCover = true;

			// Delete old file if exists
			if (recording.cover_url) {
				try {
					await deleteStorageFile(recording.cover_url, "recordings");
				} catch (error) {
					console.warn("Could not delete old cover:", error);
				}
			}

			// Upload new cover image
			const coverUrl = await uploadCoverImage(
				selectedCoverFile,
				"recordings",
				`covers/${recording.id}`
			);

			// Update database with new cover URL
			const {
				data: { user },
			} = await supabase.auth.getUser();

			const { error: dbError } = await supabase
				.from("recordings")
				.update({
					cover_url: coverUrl,
					edited_at: new Date().toISOString(),
					edited_by: user?.id || null,
				})
				.eq("id", recording.id);

			if (dbError) throw dbError;

			cover_url = coverUrl;
			toast.success("Omslagsbilden har laddats upp");
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

			// Delete from storage
			try {
				await deleteStorageFile(recording.cover_url, "recordings");
			} catch (error) {
				console.warn("Could not delete cover from storage:", error);
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

			// Delete from storage
			try {
				await deleteStorageFile(recording.captions_url, "recordings");
			} catch (error) {
				console.warn("Could not delete captions from storage:", error);
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

	async function applyTrim() {
		if (!wavesurfer || !activeRegion) return;

		try {
			showTrimControls = false;
			uploading = true;
			toast.info("Trimmar ljudfil...");

			// Get the audio buffer
			const audioBuffer = wavesurfer.getDecodedData();
			if (!audioBuffer) {
				throw new Error("Kunde inte hämta ljuddata");
			}

			const sampleRate = audioBuffer.sampleRate;
			const startSample = Math.floor(trimStart * sampleRate);
			const endSample = Math.floor(trimEnd * sampleRate);
			const trimmedLength = endSample - startSample;

			// Create a new buffer with the trimmed audio
			const trimmedBuffer = new AudioBuffer({
				numberOfChannels: audioBuffer.numberOfChannels,
				length: trimmedLength,
				sampleRate: sampleRate,
			});

			// Copy the trimmed portion
			for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
				const originalData = audioBuffer.getChannelData(channel);
				const trimmedData = trimmedBuffer.getChannelData(channel);
				for (let i = 0; i < trimmedLength; i++) {
					trimmedData[i] = originalData[startSample + i];
				}
			}

			// Convert the trimmed buffer to a blob
			const blob = await audioBufferToBlob(trimmedBuffer);

			// Create a file from the blob
			const fileName = `trimmed_${Date.now()}.mp3`;
			selectedAudioFile = new File([blob], fileName, { type: "audio/mp3" });

			// Upload the trimmed file
			await uploadAudioFileHandler();

			toast.success("Ljudfil trimmad och uppladdad!");
		} catch (error) {
			console.error("Error trimming audio:", error);
			toast.error("Kunde inte trimma ljudfil");
		} finally {
			uploading = false;
		}
	}

	// Helper function to convert AudioBuffer to Blob
	async function audioBufferToBlob(buffer: AudioBuffer): Promise<Blob> {
		const offlineContext = new OfflineAudioContext(
			buffer.numberOfChannels,
			buffer.length,
			buffer.sampleRate
		);

		const source = offlineContext.createBufferSource();
		source.buffer = buffer;
		source.connect(offlineContext.destination);
		source.start();

		const renderedBuffer = await offlineContext.startRendering();

		// Convert to WAV format
		const length = renderedBuffer.length * renderedBuffer.numberOfChannels * 2 + 44;
		const arrayBuffer = new ArrayBuffer(length);
		const view = new DataView(arrayBuffer);
		const channels = [];
		let offset = 0;
		let pos = 0;

		// Write WAV header
		const setUint16 = (data: number) => {
			view.setUint16(pos, data, true);
			pos += 2;
		};
		const setUint32 = (data: number) => {
			view.setUint32(pos, data, true);
			pos += 4;
		};

		// RIFF identifier
		setUint32(0x46464952);
		// file length
		setUint32(length - 8);
		// RIFF type
		setUint32(0x45564157);
		// format chunk identifier
		setUint32(0x20746d66);
		// format chunk length
		setUint32(16);
		// sample format (raw)
		setUint16(1);
		// channel count
		setUint16(renderedBuffer.numberOfChannels);
		// sample rate
		setUint32(renderedBuffer.sampleRate);
		// byte rate (sample rate * block align)
		setUint32(renderedBuffer.sampleRate * 2 * renderedBuffer.numberOfChannels);
		// block align (channel count * bytes per sample)
		setUint16(renderedBuffer.numberOfChannels * 2);
		// bits per sample
		setUint16(16);
		// data chunk identifier
		setUint32(0x61746164);
		// data chunk length
		setUint32(length - pos - 4);

		// write interleaved data
		for (let i = 0; i < renderedBuffer.numberOfChannels; i++) {
			channels.push(renderedBuffer.getChannelData(i));
		}

		while (pos < length) {
			for (let i = 0; i < renderedBuffer.numberOfChannels; i++) {
				let sample = Math.max(-1, Math.min(1, channels[i][offset]));
				sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
				view.setInt16(pos, sample, true);
				pos += 2;
			}
			offset++;
		}

		return new Blob([arrayBuffer], { type: "audio/wav" });
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
		const formattedSeconds = remainingSeconds.toFixed(2).padStart(5, "0");
		return `${minutes}:${formattedSeconds}`;
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
					<!-- Audio Waveform Section -->
					{#if recording.file_url}
						<div class="box mb-4">
							<h4 class="title is-6 mb-3">Ljudvågform</h4>
							<div bind:this={waveformContainer} class="waveform-container mb-3"></div>

							{#if wavesurfer}
								<div class="field">
									<div class="buttons">
										<button
											type="button"
											class="button is-small"
											on:click={() => {
												if (wavesurfer && recording) {
													if (localIsPlaying) {
														// Pause both wavesurfer and audio element
														wavesurfer.pause();
														if (audioElement && audioElement.src === recording.file_url) {
															audioElement.pause();
														}
													} else {
														// Play wavesurfer
														wavesurfer.play();
														// Ensure audio element is synced
														if (audioElement) {
															if (audioElement.src !== recording.file_url) {
																audioElement.src = recording.file_url;
															}
															audioElement.currentTime = wavesurfer.getCurrentTime();
															audioElement.play();
														}
													}
												}
											}}
										>
											{#if localIsPlaying}
												<span class="icon">
													<svg
														width="16"
														height="16"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
													>
														<rect x="6" y="4" width="4" height="16"></rect>
														<rect x="14" y="4" width="4" height="16"></rect>
													</svg>
												</span>
												<span>Pausa</span>
											{:else}
												<span class="icon">
													<svg
														width="16"
														height="16"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
													>
														<polygon points="5 3 19 12 5 21 5 3"></polygon>
													</svg>
												</span>
												<span>Spela</span>
											{/if}
										</button>

										<button
											type="button"
											class="button is-small"
											on:click={() => {
												showTrimControls = !showTrimControls;
											}}
											class:is-primary={showTrimControls}
										>
											<span class="icon">
												<Scissors size={16} />
											</span>
											<span>Trimma ljud</span>
										</button>
									</div>
								</div>

								{#if showTrimControls && activeRegion}
									<div class="notification is-info is-light mt-3">
										<p class="mb-2">
											<strong>Trimintervall:</strong>
											{formatDuration(Math.round(trimStart * 100) / 100)} - {formatDuration(
												Math.round(trimEnd * 100) / 100
											)}
										</p>
										<p class="mb-3">
											Dra i kanterna på den markerade regionen för att justera trimningen.
										</p>
										<div class="buttons">
											<button
												type="button"
												class="button is-primary is-small"
												on:click={applyTrim}
												disabled={uploading}
												class:is-loading={uploading}
											>
												<span class="icon">
													<Scissors size={16} />
												</span>
												<span>Applicera trimning</span>
											</button>
											<button
												type="button"
												class="button is-small"
												on:click={() => {
													showTrimControls = false;
													if (activeRegion && wavesurfer) {
														activeRegion.setOptions({
															start: 0,
															end: wavesurfer?.getDuration() || 0,
														});
													}
												}}
											>
												Avbryt
											</button>
										</div>
									</div>
								{/if}
							{/if}
						</div>
					{/if}

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
									<p class="label">
										Omslagsbild <span class="has-text-weight-normal has-text-grey"
											>(JPG, PNG, max 5MB)</span
										>
									</p>
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
											on:click={uploadCoverImageHandler}
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
									<p class="label">
										Undertexter <span class="has-text-weight-normal has-text-grey"
											>(SRT, VTT, TXT)</span
										>
									</p>
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
									<p class="label">
										Ersätt ljudfil <span class="has-text-weight-normal has-text-grey"
											>(Alla ljudformat stöds)</span
										>
									</p>
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
												{#if selectedAudioFile}
													{selectedAudioFile.name}
													{#if needsAudioConversion(selectedAudioFile)}
														<span class="tag is-info is-small ml-2">Konverteras till MP3</span>
													{/if}
												{:else}
													Ingen fil vald
												{/if}
											</span>
										</label>
									</div>
									{#if selectedAudioFile}
										<button
											class="button is-warning is-small is-rounded"
											type="button"
											on:click={uploadAudioFileHandler}
											disabled={uploading}
										>
											{uploading ? "Laddar upp..." : "Ersätt ljudfil"}
										</button>
										<p class="help is-danger mt-1">
											Varning: Detta ersätter den befintliga ljudfilen
										</p>
										{#if needsAudioConversion(selectedAudioFile)}
											<div class="notification is-info is-light mt-2">
												<p class="is-size-7">
													<strong>Automatisk konvertering:</strong> Din {getAudioFormatDescription(
														selectedAudioFile
													)}-fil kommer att konverteras till MP3 för bästa kompatibilitet.
												</p>
											</div>
										{/if}
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

	.waveform-container {
		width: 100%;
		min-height: 100px;
		background-color: #f5f5f5;
		border-radius: 4px;
		padding: 0.5rem;
	}

	.waveform-container :global(wave) {
		overflow: hidden !important;
	}

	.waveform-container :global(.wavesurfer-region) {
		border: 2px solid rgba(79, 74, 133, 0.5);
		border-radius: 4px;
	}

	.waveform-container :global(.wavesurfer-handle) {
		background-color: #4f4a85;
		width: 4px !important;
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
