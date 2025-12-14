<script lang="ts">
	import { onMount } from "svelte";
	import {
		Radio,
		Plus,
		Edit2,
		Calendar,
		ChevronUp,
		ChevronDown,
		FileAudio,
		Music,
		AlertTriangle,
	} from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import type { BroadcastProgram } from "@/api";
	import Layout from "@/components/Layout.svelte";
	import ProgramEditorModal from "@/modals/ProgramEditorModal.svelte";
	import ProgramRecordingsModal from "@/modals/ProgramRecordingsModal.svelte";
	import { supabase } from "@/api";
	import { programsUIState } from "@/api/ui";

	let programs: BroadcastProgram[] = [];
	let loading = true;
	let editingProgram: BroadcastProgram | null = null;
	let isEditorOpen = false;
	let isCreateMode = false;
	let managingRecordingsProgram: BroadcastProgram | null = null;
	let isRecordingsModalOpen = false;

	$: activePrograms = programs.filter((p) => p.is_active);
	$: multipleActivePrograms = activePrograms.length > 1;

	onMount(() => {
		loadPrograms();
	});

	async function loadPrograms() {
		try {
			const { data, error } = await supabase
				.from("broadcast_programs")
				.select("*")
				.order($programsUIState.sortField, {
					ascending: $programsUIState.sortOrder === "asc",
				});

			if (error) throw error;
			programs = data || [];
		} catch (error) {
			toast.error("Kunde inte ladda sändningsprogram");
			console.error(error);
		} finally {
			loading = false;
		}
	}

	function sortBy(field: keyof BroadcastProgram) {
		if ($programsUIState.sortField === field) {
			$programsUIState.sortOrder = $programsUIState.sortOrder === "asc" ? "desc" : "asc";
		} else {
			$programsUIState.sortField = field as "start_time" | "title" | "edited_at";
			$programsUIState.sortOrder = "asc";
		}
		loadPrograms();
	}

	async function toggleActiveStatus(program: BroadcastProgram) {
		const newActiveStatus = !program.is_active;

		// If activating, check if there's already an active program
		if (newActiveStatus) {
			const currentActive = programs.find((p) => p.is_active && p.id !== program.id);
			if (currentActive) {
				if (
					!confirm(
						`"${currentActive.title}" är för närvarande aktivt. Vill du inaktivera det och aktivera "${program.title}" istället?`
					)
				) {
					return;
				}

				// Deactivate the current active program
				await updateProgramActiveStatus(currentActive, false);
			}
		}

		// Update the program's active status
		await updateProgramActiveStatus(program, newActiveStatus);
	}

	async function updateProgramActiveStatus(program: BroadcastProgram, isActive: boolean) {
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			const { error } = await supabase
				.from("broadcast_programs")
				.update({
					is_active: isActive,
					edited_at: new Date().toISOString(),
					edited_by: user?.id || null,
				})
				.eq("id", program.id);

			if (error) throw error;

			toast.success(`Programmet "${program.title}" ${isActive ? "aktiverat" : "inaktiverat"}`);
			loadPrograms();
		} catch (error) {
			toast.error("Kunde inte uppdatera programstatus");
			console.error(error);
		}
	}

	function formatDateTime(dateString: string | null) {
		if (!dateString) return "N/A";
		return new Date(dateString).toLocaleString();
	}

	$: getSortIcon = (field: keyof BroadcastProgram) => {
		if ($programsUIState.sortField !== field) {
			return null;
		}
		return $programsUIState.sortOrder === "asc" ? ChevronUp : ChevronDown;
	};

	function openEditor(program: BroadcastProgram | null) {
		if (program) {
			editingProgram = program;
			isCreateMode = false;
		} else {
			editingProgram = null;
			isCreateMode = true;
		}
		isEditorOpen = true;
	}

	function handleEditorClose() {
		editingProgram = null;
		isCreateMode = false;
		isEditorOpen = false;
	}

	function handleEditorUpdate() {
		loadPrograms();
	}

	function handleEditorDelete() {
		loadPrograms();
		handleEditorClose();
	}

	function openRecordingsModal(program: BroadcastProgram) {
		managingRecordingsProgram = program;
		isRecordingsModalOpen = true;
	}

	function handleRecordingsModalClose() {
		managingRecordingsProgram = null;
		isRecordingsModalOpen = false;
	}

	function handleRecordingsModalUpdate() {
		loadPrograms();
	}

	function getRecordingCount(program: BroadcastProgram) {
		return Array.isArray(program.recordings) ? program.recordings.length : 0;
	}
</script>

<Layout fullWidth={true} requiresAdmin={true}>
	<div class="programs-management">
		<div class="level">
			<div class="level-left">
				<h2 class="title is-4">
					<span class="icon">
						<Radio />
					</span>
					Sändningsprogram
				</h2>
			</div>
			<div class="level-right">
				<button class="button is-primary" on:click={() => openEditor(null)}>
					<span class="icon">
						<Plus size={16} />
					</span>
					<span>Skapa program</span>
				</button>
			</div>
		</div>

		{#if multipleActivePrograms}
			<div class="notification is-danger">
				<div class="media">
					<div class="media-left">
						<span class="icon is-large">
							<AlertTriangle size={32} />
						</span>
					</div>
					<div class="media-content">
						<p class="title is-5">Flera aktiva program upptäckta!</p>
						<p>
							Det finns {activePrograms.length} aktiva program. Endast ett program bör vara aktivt åt
							gången. Vänligen inaktivera de program som inte ska köras.
						</p>
						<p class="mt-2">
							<strong>Aktiva program:</strong>
							{#each activePrograms as program, index}
								<span>"{program.title}"{index < activePrograms.length - 1 ? ", " : ""}</span>
							{/each}
						</p>
					</div>
				</div>
			</div>
		{/if}

		{#if loading}
			<div class="has-text-centered p-6">
				<div class="button is-loading is-large is-ghost"></div>
				<p class="mt-4">Laddar program...</p>
			</div>
		{:else if programs.length === 0}
			<div class="notification is-info is-light">
				<p>Inga sändningsprogram hittades. Skapa ett för att komma igång!</p>
			</div>
		{:else}
			<div class="table-container">
				<table class="table is-fullwidth is-striped is-hoverable">
					<thead>
						<tr>
							<th>Aktiv</th>
							<th>Omslag</th>
							<th>
								<button class="button is-ghost" on:click={() => sortBy("title")}>
									Titel
									{#if getSortIcon("title")}
										<span class="icon is-small pl-2">
											<svelte:component this={getSortIcon("title")} size={14} />
										</span>
									{/if}
								</button>
							</th>
							<th>
								<button class="button is-ghost" on:click={() => sortBy("start_time")}>
									Starttid
									{#if getSortIcon("start_time")}
										<span class="icon is-small pl-2">
											<svelte:component this={getSortIcon("start_time")} size={14} />
										</span>
									{/if}
								</button>
							</th>
							<th>Inspelningar</th>
							<th>Beskrivning</th>
							<th>
								<button class="button is-ghost" on:click={() => sortBy("edited_at")}>
									Senast ändrad
									{#if getSortIcon("edited_at")}
										<span class="icon is-small pl-2">
											<svelte:component this={getSortIcon("edited_at")} size={14} />
										</span>
									{/if}
								</button>
							</th>
							<th>Åtgärder</th>
						</tr>
					</thead>
					<tbody>
						{#each programs as program (program.id)}
							<tr>
								<td>
									<label class="radio">
										<input
											type="radio"
											name="activeProgram"
											checked={program.is_active}
											on:change={() => toggleActiveStatus(program)}
										/>
									</label>
								</td>
								<td>
									{#if program.cover_url}
										<figure class="image is-48x48">
											<img src={program.cover_url} alt="{program.title} cover" />
										</figure>
									{:else}
										<figure class="image is-48x48">
											<div class="placeholder-cover">
												<span class="icon">
													<Radio size={24} />
												</span>
											</div>
										</figure>
									{/if}
								</td>
								<td>
									<strong>{program.title}</strong>
								</td>
								<td>
									<span class="icon-text">
										<span class="icon">
											<Calendar size={14} />
										</span>
										<span>{formatDateTime(program.start_time)}</span>
									</span>
								</td>
								<td>
									<span class="icon-text">
										<span class="icon">
											<FileAudio size={14} />
										</span>
										<span>
											{getRecordingCount(program) === 0
												? "Inga inspelningar"
												: `${getRecordingCount(program)} inspelning${getRecordingCount(program) === 1 ? "" : "ar"}`}
										</span>
									</span>
								</td>
								<td>
									<small>
										{program.description?.substring(0, 50) || "-"}
										{program.description && program.description.length > 50 ? "..." : ""}
									</small>
								</td>
								<td>
									<small>{formatDateTime(program.edited_at)}</small>
								</td>
								<td>
									<div class="buttons are-small">
										<button
											class="button is-primary is-small"
											title="Edit Program"
											on:click={() => openEditor(program)}
										>
											<span class="icon">
												<Edit2 size={16} />
											</span>
											<span>Redigera</span>
										</button>
										<button
											class="button is-info is-small"
											title="Manage Recordings"
											on:click={() => openRecordingsModal(program)}
										>
											<span class="icon">
												<Music size={16} />
											</span>
											<span>Inspelningar</span>
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- Broadcast Program Editor Modal -->
	<ProgramEditorModal
		program={isCreateMode ? null : editingProgram}
		bind:isOpen={isEditorOpen}
		on:close={handleEditorClose}
		on:updated={handleEditorUpdate}
		on:deleted={handleEditorDelete}
	/>

	<!-- Program Recordings Modal -->
	<ProgramRecordingsModal
		program={managingRecordingsProgram}
		bind:isOpen={isRecordingsModalOpen}
		on:close={handleRecordingsModalClose}
		on:updated={handleRecordingsModalUpdate}
	/>
</Layout>

<style>
	.table-container {
		overflow-x: auto;
	}

	.programs-management {
		min-height: 500px;
	}

	th .button.is-ghost {
		color: inherit;
		background: none;
		border: none;
		text-decoration: none;
		padding: 0;
		height: auto;
		justify-content: flex-start;
	}

	th .button.is-ghost:hover {
		color: #3273dc;
		background: none;
	}

	.table td {
		vertical-align: middle;
	}

	.buttons {
		margin-bottom: 0;
	}

	.icon-text {
		align-items: center;
		display: inline-flex;
		justify-content: flex-start;
		line-height: 1.5;
	}

	.icon-text > .icon:first-child:not(:last-child) {
		margin-right: 0.25em;
		margin-left: 0;
	}

	.notification.is-danger {
		margin-bottom: 1.5rem;
	}

	.image.is-48x48 {
		width: 48px;
		height: 48px;
		overflow: hidden;
		border-radius: 4px;
	}

	.image.is-48x48 img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.placeholder-cover {
		width: 100%;
		height: 100%;
		background-color: #f5f5f5;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #b5b5b5;
	}
</style>
