<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { Info, Calendar, Save, Image, Trash2 } from "lucide-svelte";
	import { validateImageFile } from "@/api/fileUpload";

	export let title = "";
	export let description = "";
	export let startTime = "";
	export let coverUrl: string | null = null;
	export let disabled = false;
	export let loading = false;
	export let uploadingCover = false;
	export let isNew = false;

	const dispatch = createEventDispatcher();

	// File state
	let selectedCoverFile: File | null = null;
	let coverFileInput: HTMLInputElement;

	// Store initial values to detect changes
	let initialValues = {
		title: "",
		description: "",
		startTime: "",
		coverUrl: null as string | null,
	};

	// Track if any values have changed
	let hasChanges = false;

	$: hasChanges =
		title !== initialValues.title ||
		description !== initialValues.description ||
		startTime !== initialValues.startTime ||
		coverUrl !== initialValues.coverUrl;

	/**
	 * Initialize the form with values and store them as initial values
	 */
	export function initialize(values: {
		title: string;
		description: string;
		startTime: string;
		coverUrl?: string | null;
	}) {
		title = values.title;
		description = values.description;
		startTime = values.startTime;
		coverUrl = values.coverUrl || null;

		// Store as initial values for comparison
		initialValues = {
			title: values.title,
			description: values.description,
			startTime: values.startTime,
			coverUrl: values.coverUrl || null,
		};

		// Reset hasChanges after initialization
		hasChanges = false;
	}

	/**
	 * Reset form to initial values
	 */
	export function reset() {
		title = initialValues.title;
		description = initialValues.description;
		startTime = initialValues.startTime;
		coverUrl = initialValues.coverUrl;
		selectedCoverFile = null;
		if (coverFileInput) coverFileInput.value = "";
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

	function handleSubmit() {
		if (!title.trim() || !startTime) {
			return;
		}

		dispatch("save", {
			title,
			description,
			startTime,
			coverUrl,
		});

		// Update initial values after successful save
		initialValues = {
			title,
			description,
			startTime,
			coverUrl,
		};
	}

	function handleChange() {
		dispatch("change", {
			title,
			description,
			startTime,
			coverUrl,
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

	function uploadCover() {
		if (selectedCoverFile) {
			dispatch("uploadCover", { file: selectedCoverFile });
		}
	}

	function deleteCover() {
		dispatch("deleteCover");
	}

	function clearCoverFile() {
		selectedCoverFile = null;
		if (coverFileInput) {
			coverFileInput.value = "";
		}
	}
</script>

<form on:submit|preventDefault={handleSubmit}>
	<!-- Title Field -->
	<div class="field">
		<label class="label" for="program-title">
			Titel <span class="has-text-danger">*</span>
		</label>
		<div class="control has-icons-left">
			<input
				id="program-title"
				class="input"
				type="text"
				bind:value={title}
				on:input={handleChange}
				placeholder="Ange programtitel"
				required
				{disabled}
			/>
			<span class="icon is-small is-left">
				<Info size={16} />
			</span>
		</div>
	</div>

	<!-- Description Field -->
	<div class="field">
		<label class="label" for="program-description">Beskrivning</label>
		<div class="control">
			<textarea
				id="program-description"
				class="textarea"
				bind:value={description}
				on:input={handleChange}
				placeholder="Ange programbeskrivning"
				rows="3"
				{disabled}
			/>
		</div>
	</div>

	<!-- Start Time Field -->
	<div class="field">
		<label class="label" for="program-start-time">
			Starttid <span class="has-text-danger">*</span>
		</label>
		<div class="control has-icons-left">
			<input
				id="program-start-time"
				class="input"
				type="datetime-local"
				bind:value={startTime}
				on:input={handleChange}
				required
				{disabled}
			/>
			<span class="icon is-small is-left">
				<Calendar size={16} />
			</span>
		</div>
		<p class="help">Datum och tid när detta program ska sändas</p>
	</div>

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
				Rensa
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

		{#if !isNew && coverUrl}
			<div class="mt-2">
				<figure class="image is-128x128">
					<img src={coverUrl} alt="Program cover" />
				</figure>
			</div>
		{/if}
	</div>

	<div class="field">
		<div class="buttons is-right">
			<button
				class="button is-success"
				type="submit"
				disabled={disabled || loading || !title.trim() || !startTime}
				class:is-loading={loading}
			>
				<span class="icon is-small">
					<Save size={16} />
				</span>
				<span>{isNew ? "Skapa" : "Uppdatera"} program</span>
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
