<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { Image, FileText, Upload, Trash2 } from "lucide-svelte";
	import { needsAudioConversion } from "@/api/audioProcessing";
	import { validateCaptionFile, validateImageFile } from "@/api/fileUpload";

	export let coverUrl: string | null = null;
	export let captionsUrl: string | null = null;
	export let selectedAudioFile: File | null = null;
	export let selectedCoverFile: File | null = null;
	export let selectedCaptionsFile: File | null = null;
	export let uploading = false;
	export let uploadingCover = false;
	export let uploadingCaptions = false;

	const dispatch = createEventDispatcher();

	let audioFileInput: HTMLInputElement;
	let coverFileInput: HTMLInputElement;
	let captionsFileInput: HTMLInputElement;

	function handleAudioFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			selectedAudioFile = file;
			dispatch("audioSelect", { file });
		}
	}

	function handleCoverFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			const validation = validateImageFile(file);
			if (!validation.valid) {
				dispatch("error", { message: validation.error });
				return;
			}
			selectedCoverFile = file;
			dispatch("coverSelect", { file });
		}
	}

	function handleCaptionsFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			const validation = validateCaptionFile(file);
			if (!validation.valid) {
				dispatch("error", { message: validation.error });
				return;
			}
			selectedCaptionsFile = file;
			dispatch("captionsSelect", { file });
		}
	}

	function uploadAudio() {
		if (selectedAudioFile) {
			dispatch("uploadAudio", { file: selectedAudioFile });
		}
	}

	function uploadCover() {
		if (selectedCoverFile) {
			dispatch("uploadCover", { file: selectedCoverFile });
		}
	}

	function uploadCaptions() {
		if (selectedCaptionsFile) {
			dispatch("uploadCaptions", { file: selectedCaptionsFile });
		}
	}

	function deleteCover() {
		dispatch("deleteCover");
	}

	function deleteCaptions() {
		dispatch("deleteCaptions");
	}

	function clearAudioFile() {
		selectedAudioFile = null;
		if (audioFileInput) {
			audioFileInput.value = "";
		}
	}

	function clearCoverFile() {
		selectedCoverFile = null;
		if (coverFileInput) {
			coverFileInput.value = "";
		}
	}

	function clearCaptionsFile() {
		selectedCaptionsFile = null;
		if (captionsFileInput) {
			captionsFileInput.value = "";
		}
	}
</script>

<div class="file-upload-section">
	<hr />

	<!-- Cover Image Upload -->
	<div class="field">
		<p class="label">
			Omslagsbild
			<span class="has-text-weight-normal has-text-grey">
				(JPG, PNG, max 5MB)
			</span>
		</p>
		<div class="file has-name is-fullwidth mb-2">
			<label class="file-label">
				<input
					bind:this={coverFileInput}
					class="file-input"
					type="file"
					accept="image/*"
					on:change={handleCoverFileSelect}
					disabled={uploading || uploadingCover}
				/>
				<span class="file-cta">
					<span class="file-icon">
						<Image />
					</span>
					<span class="file-label">Välj bild...</span>
				</span>
				<span class="file-name">
					{selectedCoverFile ? selectedCoverFile.name : "Ingen bild vald"}
				</span>
			</label>
		</div>

		{#if selectedCoverFile}
			<button
				class="button is-primary is-small"
				on:click={uploadCover}
				disabled={uploadingCover}
				class:is-loading={uploadingCover}
				type="button"
			>
				Ladda upp bild
			</button>
			<button
				class="button is-text is-small"
				on:click={clearCoverFile}
				disabled={uploadingCover}
				type="button"
			>
				Avbryt
			</button>
		{/if}

		{#if coverUrl}
			<p class="help">
				<a href={coverUrl} target="_blank" rel="noopener noreferrer">
					Visa nuvarande omslagsbild
				</a>
				<button
					class="button is-danger is-small is-outlined ml-2"
					on:click={deleteCover}
					disabled={uploadingCover}
					type="button"
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
			Textfil/Undertexter
			<span class="has-text-weight-normal has-text-grey">
				(VTT, SRT, TXT, max 1MB)
			</span>
		</p>
		<div class="file has-name is-fullwidth mb-2">
			<label class="file-label">
				<input
					bind:this={captionsFileInput}
					class="file-input"
					type="file"
					accept=".vtt,.srt,.txt,.json"
					on:change={handleCaptionsFileSelect}
					disabled={uploading || uploadingCaptions}
				/>
				<span class="file-cta">
					<span class="file-icon">
						<FileText />
					</span>
					<span class="file-label">Välj fil...</span>
				</span>
				<span class="file-name">
					{selectedCaptionsFile ? selectedCaptionsFile.name : "Ingen fil vald"}
				</span>
			</label>
		</div>

		{#if selectedCaptionsFile}
			<button
				class="button is-primary is-small"
				on:click={uploadCaptions}
				disabled={uploadingCaptions}
				class:is-loading={uploadingCaptions}
				type="button"
			>
				Ladda upp textfil
			</button>
			<button
				class="button is-text is-small"
				on:click={clearCaptionsFile}
				disabled={uploadingCaptions}
				type="button"
			>
				Avbryt
			</button>
		{/if}

		<p class="help">För transkriptioner, undertexter eller sångtexter</p>

		{#if captionsUrl}
			<p class="help">
				<a href={captionsUrl} target="_blank" rel="noopener noreferrer">
					Visa nuvarande textfil
				</a>
				<button
					class="button is-danger is-small is-outlined ml-2"
					on:click={deleteCaptions}
					disabled={uploadingCaptions}
					type="button"
				>
					<span class="icon">
						<Trash2 size={14} />
					</span>
					<span>Ta bort</span>
				</button>
			</p>
		{/if}
	</div>

	<!-- Audio File Upload -->
	<div class="field mt-4">
		<p class="label">
			Ersätt ljudfil
			<span class="has-text-weight-normal has-text-grey">
				(Alla ljudformat, max 50MB)
			</span>
		</p>
		<div class="file has-name is-fullwidth mb-2">
			<label class="file-label">
				<input
					bind:this={audioFileInput}
					class="file-input"
					type="file"
					accept="audio/*"
					on:change={handleAudioFileSelect}
					disabled={uploading}
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
				class="button is-primary is-small"
				on:click={uploadAudio}
				disabled={uploading}
				class:is-loading={uploading}
				type="button"
			>
				Ladda upp ljudfil
			</button>
			<button
				class="button is-text is-small"
				on:click={clearAudioFile}
				disabled={uploading}
				type="button"
			>
				Avbryt
			</button>

			<p class="help is-danger mt-1">
				Varning: Detta kommer att ersätta den nuvarande ljudfilen
			</p>

			{#if needsAudioConversion(selectedAudioFile)}
				<div class="notification is-info is-light mt-2">
					<p class="is-size-7">
						<strong>Automatisk konvertering:</strong>
						Filen kommer att konverteras till MP3-format för bästa kompatibilitet.
						Detta kan ta några sekunder extra.
					</p>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.file.is-fullwidth {
		width: 100%;
	}

	.file.is-fullwidth .file-name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex-grow: 1;
	}
</style>
