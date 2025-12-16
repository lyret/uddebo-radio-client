<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { Info, Calendar, Save, Image, Trash2 } from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import type { BroadcastProgram } from "@/api";
	import { supabase } from "@/api";
	import { validateImageFile } from "@/api/fileUpload";

	export let program: BroadcastProgram | null = null;
	export let disabled = false;

	const dispatch = createEventDispatcher();

	// Form state
	let title = "";
	let description = "";
	let startTime = "";
	let coverUrl: string | null = null;

	// Loading states
	let loading = false;

	// File state
	let selectedCoverFile: File | null = null;
	let coverFileInput: HTMLInputElement;

	// Track the last program ID to detect actual changes
	let lastProgramId: string | null = null;

	// Initialize form only when program ID actually changes
	$: if (program?.id !== lastProgramId) {
		lastProgramId = program?.id || null;
		if (program) {
			title = program.title;
			description = program.description || "";
			startTime = program.start_time ? new Date(program.start_time).toISOString().slice(0, 16) : "";
			coverUrl = program.cover_url || null;
		} else {
			// Reset for new program
			title = "";
			description = "";
			startTime = "";
			coverUrl = null;
		}
	}

	/**
	 * Handle form submission - create or update program
	 */
	async function handleSubmit() {
		if (!title.trim() || !startTime) {
			toast.error("Vänligen fyll i alla obligatoriska fält");
			return;
		}

		loading = true;
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			let finalCoverUrl = coverUrl;

			// Upload cover image if selected
			if (selectedCoverFile) {
				const fileExt = selectedCoverFile.name.split(".").pop();
				const timestamp = Date.now();
				const programId = program?.id || `new_${timestamp}`;
				const fileName = `${programId}_${timestamp}.${fileExt}`;

				// Delete old cover if exists and it's a Supabase URL
				if (coverUrl && coverUrl.includes("supabase")) {
					const oldFileName = coverUrl.split("/").pop();
					if (oldFileName) {
						await supabase.storage.from("cover_images").remove([oldFileName]);
					}
				}

				// Upload new cover
				const { error: uploadError } = await supabase.storage
					.from("cover_images")
					.upload(fileName, selectedCoverFile);

				if (uploadError) throw uploadError;

				// Get public URL
				const { data: urlData } = supabase.storage.from("cover_images").getPublicUrl(fileName);
				finalCoverUrl = urlData.publicUrl;
			}

			const programData = {
				title: title.trim(),
				description: description.trim() || null,
				start_time: new Date(startTime).toISOString(),
				cover_url: finalCoverUrl || null,
				edited_at: new Date().toISOString(),
				edited_by: user?.id || null,
			};

			if (program) {
				// Update existing program
				const { error } = await supabase
					.from("broadcast_programs")
					.update(programData)
					.eq("id", program.id);

				if (error) throw error;
				toast.success("Sändningsprogrammet uppdaterat");

				// Update local state if cover was uploaded
				if (selectedCoverFile) {
					coverUrl = finalCoverUrl;
					selectedCoverFile = null;
					if (coverFileInput) coverFileInput.value = "";
				}

				dispatch("saved", { type: "update" });
			} else {
				// Create new program
				const { error } = await supabase.from("broadcast_programs").insert({
					...programData,
					is_active: false,
					recordings: [],
					created_at: new Date().toISOString(),
					created_by: user?.id || null,
				});

				if (error) throw error;
				toast.success("Sändningsprogrammet skapat");

				// Update local state if cover was uploaded
				if (selectedCoverFile) {
					coverUrl = finalCoverUrl;
					selectedCoverFile = null;
					if (coverFileInput) coverFileInput.value = "";
				}

				dispatch("saved", { type: "create" });
			}
		} catch (error) {
			toast.error(program ? "Kunde inte uppdatera programmet" : "Kunde inte skapa programmet");
			console.error(error);
		} finally {
			loading = false;
		}
	}

	/**
	 * Handle cover file selection
	 */
	function handleCoverFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			const validation = validateImageFile(file);
			if (!validation.valid) {
				toast.error(validation.error || "Ogiltig bildfil");
				return;
			}
			selectedCoverFile = file;
		}
	}

	/**
	 * Delete cover image from storage and clear from program
	 */
	async function deleteCover() {
		if (!program || !coverUrl) return;

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			// Delete from storage if it's a Supabase URL
			if (coverUrl.includes("supabase")) {
				const fileName = coverUrl.split("/").pop();
				if (fileName) {
					await supabase.storage.from("cover_images").remove([fileName]);
				}
			}

			// Clear from database
			const { error } = await supabase
				.from("broadcast_programs")
				.update({
					cover_url: null,
					edited_at: new Date().toISOString(),
					edited_by: user?.id || null,
				})
				.eq("id", program.id);

			if (error) throw error;

			coverUrl = null;
			toast.success("Omslagsbilden har tagits bort");
			dispatch("updated");
		} catch (error) {
			toast.error("Kunde inte ta bort omslagsbilden");
			console.error(error);
		}
	}

	/**
	 * Delete the entire program
	 */
	export async function deleteProgram() {
		if (!program) return;

		if (
			!confirm(
				"Är du säker på att du vill ta bort detta sändningsprogram? Denna åtgärd kan inte ångras."
			)
		) {
			return;
		}

		loading = true;
		try {
			const { error } = await supabase.from("broadcast_programs").delete().eq("id", program.id);

			if (error) throw error;

			toast.success("Sändningsprogrammet har tagits bort");
			dispatch("deleted");
		} catch (error) {
			toast.error("Kunde inte ta bort programmet");
			console.error(error);
		} finally {
			loading = false;
		}
	}

	/**
	 * Clear selected file
	 */
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
				placeholder="Ange programtitel"
				required
				disabled={disabled || loading}
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
				placeholder="Ange programbeskrivning"
				rows="3"
				disabled={disabled || loading}
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
				required
				disabled={disabled || loading}
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
					disabled={disabled || loading}
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
					disabled={loading}
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
				{#if program}
					<button
						class="button is-danger is-small is-outlined ml-2"
						on:click={deleteCover}
						disabled={loading}
						type="button"
					>
						<span class="icon">
							<Trash2 size={14} />
						</span>
						<span>Ta bort</span>
					</button>
				{/if}
			</p>
		{/if}

		{#if coverUrl}
			<div class="mt-2">
				<figure class="image is-128x128">
					<img src={coverUrl} alt="Program cover" />
				</figure>
			</div>
		{/if}
	</div>

	<div class="field">
		<div class="buttons is-right">
			{#if program}
				<!-- Delete Button -->
				<button
					class="button is-danger is-outlined"
					on:click|preventDefault={deleteProgram}
					disabled={loading}
					type="button"
				>
					<span class="icon">
						<Trash2 size={16} />
					</span>
					<span>Ta bort program</span>
				</button>
			{/if}
			<button
				class="button is-primary"
				type="submit"
				disabled={disabled || loading || !title.trim() || !startTime}
				class:is-loading={loading}
			>
				<span class="icon is-small">
					<Save size={16} />
				</span>
				<span>{program ? "Spara ändringar" : "Skapa program"}</span>
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
