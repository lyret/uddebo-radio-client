<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { X, Radio, Calendar, Info, Trash2, Image } from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import type { BroadcastProgram } from "@/api";
	import { supabase } from "@/api";

	export let program: BroadcastProgram | null = null;
	export let isOpen = false;

	const dispatch = createEventDispatcher();

	let title = "";
	let description = "";
	let startTime = "";
	let cover_url = "";
	let loading = false;
	let uploadingCover = false;

	// File input
	let coverFileInput: HTMLInputElement;
	let selectedCoverFile: File | null = null;

	$: if (isOpen && program) {
		loadFormData();
	} else if (isOpen && !program) {
		resetForm();
	}

	function loadFormData() {
		if (!program) return;

		title = program.title;
		description = program.description || "";
		startTime = program.start_time ? new Date(program.start_time).toISOString().slice(0, 16) : "";
		cover_url = program.cover_url || "";
	}

	function resetForm() {
		title = "";
		description = "";
		startTime = "";
		cover_url = "";
		selectedCoverFile = null;
		if (coverFileInput) coverFileInput.value = "";
	}

	async function handleSubmit() {
		if (!title.trim() || !startTime) {
			toast.error("Please fill in all required fields");
			return;
		}

		loading = true;
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			const programData = {
				title: title.trim(),
				description: description.trim() || null,
				start_time: new Date(startTime).toISOString(),
				cover_url: cover_url || null,
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
				toast.success("Broadcast program updated successfully");
			} else {
				// Create new program
				const { error } = await supabase.from("broadcast_programs").insert({
					...programData,
					is_active: false, // Always false for new programs
					recordings: [], // Empty recordings array for new programs
					created_at: new Date().toISOString(),
					created_by: user?.id || null,
				});

				if (error) throw error;
				toast.success("Broadcast program created successfully");
			}

			dispatch("updated");
			handleClose();
		} catch (error) {
			toast.error(program ? "Failed to update program" : "Failed to create program");
			console.error(error);
		} finally {
			loading = false;
		}
	}

	async function handleDelete() {
		if (!program) return;

		if (
			!confirm(
				"Are you sure you want to delete this broadcast program? This action cannot be undone."
			)
		)
			return;

		loading = true;
		try {
			const { error } = await supabase.from("broadcast_programs").delete().eq("id", program.id);

			if (error) throw error;

			toast.success("Broadcast program deleted successfully");
			dispatch("deleted");
			handleClose();
		} catch (error) {
			toast.error("Failed to delete program");
			console.error(error);
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		resetForm();
		isOpen = false;
		dispatch("close");
	}

	async function handleCoverFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			selectedCoverFile = input.files[0];
			// Validate file type
			if (!selectedCoverFile.type.startsWith("image/")) {
				toast.error("Please select an image file");
				selectedCoverFile = null;
				return;
			}
		}
	}

	async function uploadCoverImage() {
		if (!selectedCoverFile || !program) return;

		try {
			uploadingCover = true;

			// Upload cover image with timestamp for uniqueness
			const fileExt = selectedCoverFile.name.split(".").pop();
			const timestamp = Date.now();
			const fileName = `${program.id}_${timestamp}.${fileExt}`;

			// Delete old cover if exists
			if (program.cover_url && program.cover_url.includes("supabase")) {
				const oldFileName = program.cover_url.split("/").pop();
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
				.from("broadcast_programs")
				.update({
					cover_url: urlData.publicUrl,
					edited_at: new Date().toISOString(),
					edited_by: user?.id || null,
				})
				.eq("id", program.id);

			if (dbError) throw dbError;

			// Update local program object
			program.cover_url = urlData.publicUrl;

			toast.success("Cover image uploaded and saved");
			selectedCoverFile = null;
			coverFileInput.value = "";
			dispatch("updated");
		} catch (error) {
			toast.error("Failed to upload cover image");
			console.error(error);
		} finally {
			uploadingCover = false;
		}
	}

	async function deleteCoverImage() {
		if (!program || !program.cover_url) return;

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			// Delete from storage if it's a Supabase URL
			if (program.cover_url.includes("supabase")) {
				const fileName = program.cover_url.split("/").pop();
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

			// Update local state
			program.cover_url = null;
			cover_url = "";

			toast.success("Cover image deleted");
			dispatch("updated");
		} catch (error) {
			toast.error("Failed to delete cover image");
			console.error(error);
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
					<Radio />
				</span>
				<span>{program ? "Edit" : "Create"} Broadcast Program</span>
			</p>
			<button class="delete" aria-label="close" on:click={handleClose} disabled={loading}></button>
		</header>
		<section class="modal-card-body">
			<form id="program-form" on:submit|preventDefault={handleSubmit}>
				<!-- Title Field -->
				<div class="field">
					<label class="label" for="program-title">
						Title <span class="has-text-danger">*</span>
					</label>
					<div class="control has-icons-left">
						<input
							id="program-title"
							class="input"
							type="text"
							bind:value={title}
							placeholder="Enter program title"
							required
							disabled={loading}
						/>
						<span class="icon is-small is-left">
							<Info size={16} />
						</span>
					</div>
				</div>

				<!-- Description Field -->
				<div class="field">
					<label class="label" for="program-description">Description</label>
					<div class="control">
						<textarea
							id="program-description"
							class="textarea"
							bind:value={description}
							placeholder="Enter program description"
							rows="3"
							disabled={loading}
						/>
					</div>
				</div>

				<!-- Start Time Field -->
				<div class="field">
					<label class="label" for="program-start-time">
						Start Time <span class="has-text-danger">*</span>
					</label>
					<div class="control has-icons-left">
						<input
							id="program-start-time"
							class="input"
							type="datetime-local"
							bind:value={startTime}
							required
							disabled={loading}
						/>
						<span class="icon is-small is-left">
							<Calendar size={16} />
						</span>
					</div>
					<p class="help">The date and time when this program should be broadcast</p>
				</div>

				<!-- Cover Image Upload -->
				<div class="field">
					<p class="label">Cover Image</p>
					<div class="file has-name is-fullwidth mb-2">
						<label class="file-label">
							<input
								bind:this={coverFileInput}
								class="file-input"
								type="file"
								accept="image/*"
								on:change={handleCoverFileSelect}
								disabled={loading}
							/>
							<span class="file-cta">
								<span class="file-icon">
									<Image size={16} />
								</span>
								<span class="file-label">Choose cover image...</span>
							</span>
							<span class="file-name">
								{selectedCoverFile ? selectedCoverFile.name : "No file selected"}
							</span>
						</label>
					</div>
					{#if selectedCoverFile}
						<button
							class="button is-info is-small"
							type="button"
							on:click={uploadCoverImage}
							disabled={uploadingCover || loading}
						>
							{uploadingCover ? "Uploading..." : "Upload Cover"}
						</button>
					{/if}
					{#if cover_url || (program && program.cover_url)}
						<p class="help">
							Current: <a href={cover_url || program.cover_url} target="_blank">View cover image</a>
							<button
								class="button is-danger is-small ml-2"
								type="button"
								on:click={deleteCoverImage}
								disabled={loading}
							>
								<span class="icon">
									<Trash2 size={14} />
								</span>
								<span>Delete</span>
							</button>
						</p>
					{/if}
				</div>

				<!-- Cover Image Preview -->
				{#if cover_url || (program && program.cover_url)}
					<div class="field">
						<p class="label">Cover Preview</p>
						<figure class="image is-square">
							<img src={cover_url || program?.cover_url} alt="Program cover" />
						</figure>
					</div>
				{/if}

				{#if !program}
					<div class="notification is-info is-light">
						<p class="is-size-7">
							<strong>Note:</strong> New programs are created as inactive. You can activate them after
							adding recordings.
						</p>
					</div>
				{/if}
			</form>

			<div class="level is-mobile mt-5">
				{#if program}
					<div class="level-left">
						<div class="level-item">
							<button
								class="button is-danger is-outlined"
								on:click={handleDelete}
								disabled={loading}
							>
								<span class="icon">
									<Trash2 size={16} />
								</span>
								<span>Delete Program</span>
							</button>
						</div>
					</div>
				{/if}
				<hr />
				<div class="level-right">
					<div class="level-item">
						<button
							type="submit"
							form="program-form"
							class="button is-primary"
							class:is-loading={loading}
							disabled={loading}
						>
							{program ? "Update" : "Create"} Program
						</button>
					</div>
					<div class="level-item">
						<button class="button" on:click={handleClose} disabled={loading}>Cancel</button>
					</div>
				</div>
			</div>
		</section>
	</div>
</div>

<style>
	.modal-card {
		width: 90%;
		max-width: 600px;
	}

	.modal-card-body {
		max-height: calc(100vh - 200px);
		overflow-y: auto;
	}
</style>
