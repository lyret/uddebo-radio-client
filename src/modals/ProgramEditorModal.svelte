<script lang="ts">
	import { createEventDispatcher, onMount } from "svelte";
	import { Radio, Trash2 } from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import type { BroadcastProgram } from "@/api";
	import { supabase } from "@/api";
	import ProgramInformationForm from "@/components/program/ProgramInformationForm.svelte";

	export let program: BroadcastProgram | null = null;
	export let isOpen = false;

	const dispatch = createEventDispatcher();

	let title = "";
	let description = "";
	let startTime = "";
	let cover_url = "";
	let loading = false;
	let uploadingCover = false;

	// Form ref
	let formComponent: ProgramInformationForm;

	$: if (isOpen && program) {
		loadFormData();
	} else if (isOpen && !program) {
		resetForm();
	}

	// Initialize form when component is mounted and program exists
	onMount(() => {
		if (program && formComponent) {
			loadFormData();
		}
	});

	function loadFormData() {
		if (!program) return;

		title = program.title;
		description = program.description || "";
		startTime = program.start_time ? new Date(program.start_time).toISOString().slice(0, 16) : "";
		cover_url = program.cover_url || "";

		// Initialize the form component with current values
		if (formComponent) {
			formComponent.initialize({
				title,
				description,
				startTime,
				coverUrl: cover_url,
			});
		}
	}

	function resetForm() {
		title = "";
		description = "";
		startTime = "";
		cover_url = "";

		// Initialize the form component for new program
		if (formComponent) {
			formComponent.initialize({
				title: "",
				description: "",
				startTime: "",
				coverUrl: null,
			});
		}
	}

	async function handleSave(event: CustomEvent) {
		const formData = event.detail;

		if (!formData.title.trim() || !formData.startTime) {
			toast.error("Vänligen fyll i alla obligatoriska fält");
			return;
		}

		loading = true;
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			const programData = {
				title: formData.title.trim(),
				description: formData.description.trim() || null,
				start_time: new Date(formData.startTime).toISOString(),
				cover_url: formData.coverUrl || null,
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
				toast.success("Sändningsprogrammet skapat");
			}

			// Update form's initial values after successful save
			if (formComponent && program) {
				formComponent.initialize({
					title: formData.title,
					description: formData.description,
					startTime: formData.startTime,
					coverUrl: formData.coverUrl,
				});
			}

			dispatch("updated");
			if (!program) {
				handleClose();
			}
		} catch (error) {
			toast.error(program ? "Kunde inte uppdatera programmet" : "Kunde inte skapa programmet");
			console.error(error);
		} finally {
			loading = false;
		}
	}

	async function handleUploadCover(event: CustomEvent<{ file: File }>) {
		if (!program && !isOpen) return;

		const file = event.detail.file;

		try {
			uploadingCover = true;

			// Generate unique filename
			const fileExt = file.name.split(".").pop();
			const timestamp = Date.now();
			const programId = program?.id || `new_${timestamp}`;
			const fileName = `${programId}_${timestamp}.${fileExt}`;

			// Delete old cover if exists and it's a Supabase URL
			if (program?.cover_url && program.cover_url.includes("supabase")) {
				const oldFileName = program.cover_url.split("/").pop();
				if (oldFileName) {
					await supabase.storage.from("cover_images").remove([oldFileName]);
				}
			}

			// Upload new cover
			const { error: uploadError } = await supabase.storage
				.from("cover_images")
				.upload(fileName, file);

			if (uploadError) throw uploadError;

			// Get public URL
			const { data: urlData } = supabase.storage.from("cover_images").getPublicUrl(fileName);

			// Update form state
			cover_url = urlData.publicUrl;
			if (formComponent) {
				formComponent.updateCoverUrl(urlData.publicUrl);
			}

			// If editing existing program, save to database immediately
			if (program) {
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
				dispatch("updated");
			}

			toast.success("Omslagsbilden har laddats upp");
		} catch (error) {
			toast.error("Kunde inte ladda upp omslagsbilden");
			console.error(error);
		} finally {
			uploadingCover = false;
		}
	}

	async function handleDeleteCover() {
		if (!program) return;

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			// Delete from storage if it's a Supabase URL
			if (program.cover_url && program.cover_url.includes("supabase")) {
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
			if (formComponent) {
				formComponent.updateCoverUrl(null);
			}

			toast.success("Omslagsbilden har tagits bort");
			dispatch("updated");
		} catch (error) {
			toast.error("Kunde inte ta bort omslagsbilden");
			console.error(error);
		}
	}

	async function handleDelete() {
		if (!program) return;

		if (
			!confirm(
				"Är du säker på att du vill ta bort detta sändningsprogram? Denna åtgärd kan inte ångras."
			)
		)
			return;

		loading = true;
		try {
			const { error } = await supabase.from("broadcast_programs").delete().eq("id", program.id);

			if (error) throw error;

			toast.success("Sändningsprogrammet har tagits bort");
			dispatch("deleted");
			handleClose();
		} catch (error) {
			toast.error("Kunde inte ta bort programmet");
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

	function handleError(event: CustomEvent<{ message: string }>) {
		toast.error(event.detail.message);
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
				<span>{program ? "Redigera" : "Skapa"} sändningsprogram</span>
			</p>
			<button class="delete" aria-label="close" on:click={handleClose} disabled={loading}></button>
		</header>
		<section class="modal-card-body">
			<ProgramInformationForm
				bind:this={formComponent}
				bind:title
				bind:description
				bind:startTime
				bind:coverUrl={cover_url}
				disabled={loading || uploadingCover}
				{loading}
				{uploadingCover}
				isNew={!program}
				on:save={handleSave}
				on:uploadCover={handleUploadCover}
				on:deleteCover={handleDeleteCover}
				on:error={handleError}
			/>

			{#if program}
				<!-- Delete Button -->
				<div class="field mt-5">
					<button class="button is-danger is-outlined" on:click={handleDelete} disabled={loading}>
						<span class="icon">
							<Trash2 size={16} />
						</span>
						<span>Ta bort program</span>
					</button>
				</div>
			{/if}
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
