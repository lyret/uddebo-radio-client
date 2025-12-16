<script lang="ts">
	import { createEventDispatcher, onMount } from "svelte";
	import { Save, Image, FileText, Trash2, Info } from "lucide-svelte";
	import type { RecordingType } from "@/api/supabase/types";
	import { getAllSwedishRecordingTypes } from "@/api/lang";
	import { validateImageFile, validateCaptionFile } from "@/api/fileUpload";

	export let title = "";
	export let author = "";
	export let description = "";
	export let type: RecordingType = "unknown";
	export let linkOutUrl = "";
	export let coverUrl: string | null = null;
	export let captionsUrl: string | null = null;
	export let disabled = false;
	export let saving = false;
	export let uploadingCover = false;
	export let uploadingCaptions = false;

	const dispatch = createEventDispatcher();
	const recordingTypes = getAllSwedishRecordingTypes();

	// File state
	let selectedCoverFile: File | null = null;
	let selectedCaptionsFile: File | null = null;
	let coverFileInput: HTMLInputElement;
	let captionsFileInput: HTMLInputElement;

	// Store initial values to detect changes
	let initialValues = {
		title: "",
		author: "",
		description: "",
		type: "unknown" as RecordingType,
		linkOutUrl: "",
		coverUrl: null as string | null,
		captionsUrl: null as string | null,
	};

	// Initialize with the bound prop values when component mounts
	let initialized = false;

	onMount(() => {
		if (!initialized) {
			initialValues = {
				title,
				author,
				description,
				type,
				linkOutUrl,
				coverUrl,
				captionsUrl,
			};
			initialized = true;
		}
	});

	// Track if any values have changed
	let hasChanges = false;

	$: hasChanges =
		initialized &&
		(title !== initialValues.title ||
			author !== initialValues.author ||
			description !== initialValues.description ||
			type !== initialValues.type ||
			linkOutUrl !== initialValues.linkOutUrl ||
			coverUrl !== initialValues.coverUrl ||
			captionsUrl !== initialValues.captionsUrl ||
			selectedCoverFile !== null ||
			selectedCaptionsFile !== null);

	/**
	 * Initialize the form with values and store them as initial values
	 */
	export function initialize(values: {
		title: string;
		author: string;
		description: string;
		type: RecordingType;
		linkOutUrl: string;
		coverUrl?: string | null;
		captionsUrl?: string | null;
	}) {
		title = values.title;
		author = values.author;
		description = values.description;
		type = values.type;
		linkOutUrl = values.linkOutUrl;
		coverUrl = values.coverUrl || null;
		captionsUrl = values.captionsUrl || null;

		// Store as initial values for comparison
		initialValues = {
			title: values.title,
			author: values.author,
			description: values.description,
			type: values.type,
			linkOutUrl: values.linkOutUrl,
			coverUrl: values.coverUrl || null,
			captionsUrl: values.captionsUrl || null,
		};

		// Mark as initialized and reset file selections
		initialized = true;
		selectedCoverFile = null;
		selectedCaptionsFile = null;
		if (coverFileInput) coverFileInput.value = "";
		if (captionsFileInput) captionsFileInput.value = "";
	}

	/**
	 * Reset form to initial values
	 */
	export function reset() {
		title = initialValues.title;
		author = initialValues.author;
		description = initialValues.description;
		type = initialValues.type;
		linkOutUrl = initialValues.linkOutUrl;
		coverUrl = initialValues.coverUrl;
		captionsUrl = initialValues.captionsUrl;
		selectedCoverFile = null;
		selectedCaptionsFile = null;
		if (coverFileInput) coverFileInput.value = "";
		if (captionsFileInput) captionsFileInput.value = "";
	}

	/**
	 * Update cover URL after successful upload
	 */
	export function updateCoverUrl(url: string | null) {
		coverUrl = url;
		initialValues.coverUrl = url;
		selectedCoverFile = null;
		if (coverFileInput) coverFileInput.value = "";
	}

	/**
	 * Update captions URL after successful upload
	 */
	export function updateCaptionsUrl(url: string | null) {
		captionsUrl = url;
		initialValues.captionsUrl = url;
		selectedCaptionsFile = null;
		if (captionsFileInput) captionsFileInput.value = "";
	}

	function handleSubmit() {
		dispatch("save", {
			title,
			author,
			description,
			type,
			link_out_url: linkOutUrl,
			coverFile: selectedCoverFile,
			captionsFile: selectedCaptionsFile,
		});

		// Update initial values after successful save
		initialValues = {
			title,
			author,
			description,
			type,
			linkOutUrl,
			coverUrl,
			captionsUrl,
		};
	}

	function handleChange() {
		dispatch("change", {
			title,
			author,
			description,
			type,
			link_out_url: linkOutUrl,
			hasChanges,
		});
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
		}
	}

	function deleteCover() {
		dispatch("deleteCover");
	}

	function deleteCaptions() {
		dispatch("deleteCaptions");
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

<form on:submit|preventDefault={handleSubmit}>
	<div class="field">
		<label class="label" for="modal-title">Titel *</label>
		<div class="control">
			<input
				id="modal-title"
				class="input"
				type="text"
				bind:value={title}
				on:input={handleChange}
				placeholder="Titel på inspelningen"
				required
				{disabled}
			/>
		</div>
	</div>

	<div class="field">
		<label class="label" for="modal-author">Artist/Upphovsperson</label>
		<div class="control">
			<input
				id="modal-author"
				class="input"
				type="text"
				bind:value={author}
				on:input={handleChange}
				placeholder="Artist, band eller upphovsperson"
				{disabled}
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
				on:input={handleChange}
				placeholder="Beskrivning av inspelningen"
				rows="3"
				{disabled}
			></textarea>
		</div>
	</div>

	<div class="field">
		<label class="label" for="modal-type">Typ av inspelning</label>
		<div class="control">
			<div class="select is-fullwidth">
				<select id="modal-type" bind:value={type} on:change={handleChange} {disabled}>
					{#each recordingTypes as recordingType}
						<option value={recordingType.value}>
							{recordingType.label}
						</option>
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
				bind:value={linkOutUrl}
				on:input={handleChange}
				placeholder="https://..."
				{disabled}
			/>
		</div>
		<p class="help">Länk till artist, Spotify, YouTube eller annan relevant sida</p>
	</div>

	<hr />

	<!-- Cover Image Upload -->
	<div class="field">
		<p class="label">
			Omslagsbild
			<span class="has-text-weight-normal has-text-grey"> (JPG, PNG, max 5MB) </span>
		</p>
		<div class="file has-name is-fullwidth mb-2">
			<label class="file-label">
				<input
					bind:this={coverFileInput}
					class="file-input"
					type="file"
					accept="image/*"
					on:change={handleCoverFileSelect}
					disabled={disabled || uploadingCover}
				/>
				<span class="file-cta">
					<span class="file-icon">
						<Image size={16} />
					</span>
					<span class="file-label">Välj bild...</span>
				</span>
				<span class="file-name">
					{selectedCoverFile ? selectedCoverFile.name : "Ingen bild vald"}
				</span>
			</label>
		</div>

		{#if selectedCoverFile}
			<div class="help">
				<span class="icon is-small">
					<Info size={14} />
				</span>
				<span>Bilden kommer att laddas upp när du sparar ändringarna</span>
				<button
					class="button is-text is-small ml-2"
					on:click={clearCoverFile}
					disabled={uploadingCover}
					type="button"
				>
					Rensa
				</button>
			</div>
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
			<span class="has-text-weight-normal has-text-grey"> (VTT, SRT, TXT, max 1MB) </span>
		</p>
		<div class="file has-name is-fullwidth mb-2">
			<label class="file-label">
				<input
					bind:this={captionsFileInput}
					class="file-input"
					type="file"
					accept=".vtt,.srt,.txt,.json"
					on:change={handleCaptionsFileSelect}
					disabled={disabled || uploadingCaptions}
				/>
				<span class="file-cta">
					<span class="file-icon">
						<FileText size={16} />
					</span>
					<span class="file-label">Välj fil...</span>
				</span>
				<span class="file-name">
					{selectedCaptionsFile ? selectedCaptionsFile.name : "Ingen fil vald"}
				</span>
			</label>
		</div>

		{#if selectedCaptionsFile}
			<div class="help">
				<span class="icon is-small">
					<Info size={14} />
				</span>
				<span>Textfilen kommer att laddas upp när du sparar ändringarna</span>
				<button
					class="button is-text is-small ml-2"
					on:click={clearCaptionsFile}
					disabled={uploadingCaptions}
					type="button"
				>
					Rensa
				</button>
			</div>
		{/if}

		<p class="help">För transkriptioner, undertexter eller sångtexter</p>

		{#if captionsUrl}
			<p class="help">
				<a href={captionsUrl} target="_blank" rel="noopener noreferrer"> Visa nuvarande textfil </a>
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

	<div class="field">
		<div class="buttons is-right">
			<button
				class="button is-primary"
				type="submit"
				disabled={!hasChanges || disabled || saving}
				class:is-loading={saving}
			>
				<span class="icon">
					<Save size={16} />
				</span>
				<span>Spara ändringar</span>
			</button>
		</div>
	</div>
</form>

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
