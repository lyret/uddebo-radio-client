<script lang="ts">
	import { onMount } from "svelte";
	import { push } from "svelte-spa-router";
	import {
		Radio,
		Plus,
		Edit2,
		Trash2,
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
	import BroadcastProgramEditorModal from "@/components/BroadcastProgramEditorModal.svelte";
	import ProgramRecordingsModal from "@/components/ProgramRecordingsModal.svelte";
	import { supabase, isAdmin } from "@/api";

	let programs: BroadcastProgram[] = [];
	let loading = true;
	let sortField: keyof BroadcastProgram = "start_time";
	let sortOrder: "asc" | "desc" = "asc";
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
				.order(sortField, {
					ascending: sortOrder === "asc",
				});

			if (error) throw error;
			programs = data || [];
		} catch (error) {
			toast.error("Failed to load broadcast programs");
			console.error(error);
		} finally {
			loading = false;
		}
	}

	function sortBy(field: keyof BroadcastProgram) {
		if (sortField === field) {
			sortOrder = sortOrder === "asc" ? "desc" : "asc";
		} else {
			sortField = field;
			sortOrder = "asc";
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
						`"${currentActive.title}" is currently active. Do you want to deactivate it and activate "${program.title}" instead?`
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

			toast.success(`Program "${program.title}" ${isActive ? "activated" : "deactivated"}`);
			loadPrograms();
		} catch (error) {
			toast.error("Failed to update program status");
			console.error(error);
		}
	}

	function formatDateTime(dateString: string | null) {
		if (!dateString) return "N/A";
		return new Date(dateString).toLocaleString();
	}

	function getSortIcon(field: keyof BroadcastProgram) {
		if (sortField !== field) return null;
		return sortOrder === "asc" ? ChevronUp : ChevronDown;
	}

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
					Broadcast Programs
				</h2>
			</div>
			<div class="level-right">
				<button class="button is-primary" on:click={() => openEditor(null)}>
					<span class="icon">
						<Plus size={16} />
					</span>
					<span>Create Program</span>
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
						<p class="title is-5">Multiple Active Programs Detected!</p>
						<p>
							There are {activePrograms.length} active programs. Only one program should be active at
							a time. Please deactivate the programs that should not be running.
						</p>
						<p class="mt-2">
							<strong>Active programs:</strong>
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
				<p class="mt-4">Loading programs...</p>
			</div>
		{:else if programs.length === 0}
			<div class="notification is-info is-light">
				<p>No broadcast programs found. Create one to get started!</p>
			</div>
		{:else}
			<div class="table-container">
				<table class="table is-fullwidth is-striped is-hoverable">
					<thead>
						<tr>
							<th>Active</th>
							<th>Cover</th>
							<th>
								<button class="button is-ghost" on:click={() => sortBy("title")}>
									Title
									{#if getSortIcon("title")}
										<span class="icon is-small">
											<svelte:component this={getSortIcon("title")} size={14} />
										</span>
									{/if}
								</button>
							</th>
							<th>
								<button class="button is-ghost" on:click={() => sortBy("start_time")}>
									Start Time
									{#if getSortIcon("start_time")}
										<span class="icon is-small">
											<svelte:component this={getSortIcon("start_time")} size={14} />
										</span>
									{/if}
								</button>
							</th>
							<th>Recordings</th>
							<th>Description</th>
							<th>
								<button class="button is-ghost" on:click={() => sortBy("edited_at")}>
									Last Edited
									{#if getSortIcon("edited_at")}
										<span class="icon is-small">
											<svelte:component this={getSortIcon("edited_at")} size={14} />
										</span>
									{/if}
								</button>
							</th>
							<th>Actions</th>
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
												? "No recordings"
												: `${getRecordingCount(program)} recording${getRecordingCount(program) === 1 ? "" : "s"}`}
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
											<span>Edit</span>
										</button>
										<button
											class="button is-info is-small"
											title="Manage Recordings"
											on:click={() => openRecordingsModal(program)}
										>
											<span class="icon">
												<Music size={16} />
											</span>
											<span>Recordings</span>
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
	<BroadcastProgramEditorModal
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
