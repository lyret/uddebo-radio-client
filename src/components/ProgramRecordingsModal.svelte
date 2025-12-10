<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import {
		FileAudio,
		Music,
		ChevronUp,
		ChevronDown,
		X,
		Filter,
		ArrowUpDown,
		AlertCircle,
	} from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import { flip } from "svelte/animate";
	import type { BroadcastProgram, Recording } from "@/api";
	import { supabase } from "@/api";
	import { draggable, dropzone, sortable, arrayMove, type DragData } from "@/lib/dndWrapper";

	export let program: BroadcastProgram | null = null;
	export let isOpen = false;

	const dispatch = createEventDispatcher();

	let selectedRecordings: Array<{ id: string; uniqueKey: string }> = [];
	let availableRecordings: Recording[] = [];
	let allRecordings: Recording[] = [];
	let loading = false;
	let loadingRecordings = true;

	// Filter and sort state
	let filterType = "all";
	let sortBy: "title" | "edited_at" | "author" = "title";
	let sortOrder: "asc" | "desc" = "asc";
	let searchQuery = "";

	// Refs for drop zones
	let selectedListRef: HTMLElement;

	$: if (isOpen && program) {
		loadRecordings().then(() => loadFormData());
	}

	$: filteredAndSortedRecordings = filterAndSortRecordings(
		allRecordings,
		filterType,
		sortBy,
		sortOrder,
		searchQuery
	);

	function filterAndSortRecordings(
		recordings: Recording[],
		type: string,
		sortField: "title" | "edited_at" | "author",
		order: "asc" | "desc",
		search: string
	): Recording[] {
		let filtered = recordings;

		// Filter by type
		if (type !== "all") {
			filtered = filtered.filter((r) => r.type === type);
		}

		// Filter by search query
		if (search) {
			const query = search.toLowerCase();
			filtered = filtered.filter(
				(r) =>
					r.title?.toLowerCase().includes(query) ||
					r.author?.toLowerCase().includes(query) ||
					r.description?.toLowerCase().includes(query)
			);
		}

		// Sort
		filtered = [...filtered].sort((a, b) => {
			let aVal: any;
			let bVal: any;

			switch (sortField) {
				case "title":
					aVal = a.title || "";
					bVal = b.title || "";
					break;
				case "edited_at":
					aVal = a.edited_at || a.created_at || "";
					bVal = b.edited_at || b.created_at || "";
					break;
				case "author":
					aVal = a.author || "";
					bVal = b.author || "";
					break;
			}

			if (sortField === "edited_at") {
				// Date comparison
				const dateA = new Date(aVal).getTime();
				const dateB = new Date(bVal).getTime();
				return order === "asc" ? dateA - dateB : dateB - dateA;
			} else {
				// String comparison
				const comparison = aVal.localeCompare(bVal);
				return order === "asc" ? comparison : -comparison;
			}
		});

		return filtered;
	}

	function loadFormData() {
		if (!program) return;
		// Convert simple array to array of objects with unique keys
		selectedRecordings = Array.isArray(program.recordings)
			? program.recordings.map((id, index) => ({
					id,
					uniqueKey: `${id}-${Date.now()}-${index}`,
				}))
			: [];
	}

	async function loadRecordings() {
		loadingRecordings = true;
		try {
			const { data, error } = await supabase
				.from("recordings")
				.select("*")
				.not("okey_at", "is", null)
				.order("title", { ascending: true });

			if (error) throw error;
			allRecordings = data || [];
		} catch (error) {
			toast.error("Failed to load recordings");
			console.error(error);
		} finally {
			loadingRecordings = false;
		}
	}

	async function handleSave() {
		if (!program) return;

		loading = true;
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			// Extract just the IDs from the selected recordings
			const recordingIds = selectedRecordings.map((r) => r.id);

			const { error } = await supabase
				.from("broadcast_programs")
				.update({
					recordings: recordingIds,
					edited_at: new Date().toISOString(),
					edited_by: user?.id || null,
				})
				.eq("id", program.id);

			if (error) throw error;

			toast.success("Program recordings updated successfully");
			dispatch("updated");
			handleClose();
		} catch (error) {
			toast.error("Failed to update program recordings");
			console.error(error);
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		isOpen = false;
		dispatch("close");
	}

	function addRecording(recordingId: string) {
		selectedRecordings = [
			...selectedRecordings,
			{
				id: recordingId,
				uniqueKey: `${recordingId}-${Date.now()}`,
			},
		];
	}

	function removeRecording(uniqueKey: string) {
		selectedRecordings = selectedRecordings.filter((r) => r.uniqueKey !== uniqueKey);
	}

	function moveRecording(index: number, direction: "up" | "down") {
		const newRecordings = [...selectedRecordings];
		if (direction === "up" && index > 0) {
			[newRecordings[index - 1], newRecordings[index]] = [
				newRecordings[index],
				newRecordings[index - 1],
			];
		} else if (direction === "down" && index < newRecordings.length - 1) {
			[newRecordings[index], newRecordings[index + 1]] = [
				newRecordings[index + 1],
				newRecordings[index],
			];
		}
		selectedRecordings = newRecordings;
	}

	function getRecordingInfo(recordingId: string): Recording | undefined {
		return allRecordings.find((r) => r.id === recordingId);
	}

	function formatDuration(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	}

	function getTotalDuration(): string {
		const total = selectedRecordings.reduce((sum, item) => {
			const recording = getRecordingInfo(item.id);
			return sum + (recording?.duration || 0);
		}, 0);
		return formatDuration(total);
	}

	function toggleSort(field: "title" | "edited_at" | "author") {
		if (sortBy === field) {
			sortOrder = sortOrder === "asc" ? "desc" : "asc";
		} else {
			sortBy = field;
			sortOrder = "asc";
		}
	}

	// Get unique types for filter dropdown
	$: recordingTypes = [
		"all",
		...Array.from(new Set(allRecordings.map((r) => r.type).filter(Boolean))),
	];

	// Drag and drop handlers
	function handleDropOnSelected(dragData: DragData) {
		if (dragData.type === "available-recording") {
			addRecording(dragData.id);
		}
	}

	function handleSortableSort(fromIndex: number, toIndex: number) {
		selectedRecordings = arrayMove(selectedRecordings, fromIndex, toIndex);
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
					<Music />
				</span>
				<span>Manage Program Recordings</span>
			</p>
			<button class="delete" aria-label="close" on:click={handleClose} disabled={loading}></button>
		</header>
		<section class="modal-card-body">
			{#if program}
				<div class="mb-4">
					<h2 class="subtitle is-5 mb-2">{program.title}</h2>
					<p class="help">
						Drag recordings from the left panel to add them to the program. Reorder by dragging
						within the right panel.
					</p>
				</div>

				<div class="dual-listbox">
					<!-- Available Recordings Panel -->
					<div class="listbox-panel">
						<div class="panel-header">
							<h3 class="subtitle is-6 mb-2">Available Recordings</h3>
							<div class="controls">
								<!-- Search -->
								<div class="field has-addons mb-2">
									<div class="control is-expanded">
										<input
											class="input is-small"
											type="text"
											placeholder="Search recordings..."
											bind:value={searchQuery}
										/>
									</div>
								</div>

								<!-- Filter and Sort Controls -->
								<div class="field is-grouped is-grouped-multiline">
									<div class="control">
										<div class="select is-small">
											<select bind:value={filterType}>
												{#each recordingTypes as type}
													<option value={type}>
														{type === "all" ? "All Types" : type}
													</option>
												{/each}
											</select>
										</div>
									</div>
									<div class="control">
										<div class="buttons has-addons">
											<button
												class="button is-small"
												class:is-info={sortBy === "title"}
												on:click={() => toggleSort("title")}
											>
												Title
												{#if sortBy === "title"}
													<span class="icon is-small ml-1">
														<ArrowUpDown size={12} />
													</span>
												{/if}
											</button>
											<button
												class="button is-small"
												class:is-info={sortBy === "edited_at"}
												on:click={() => toggleSort("edited_at")}
											>
												Date
												{#if sortBy === "edited_at"}
													<span class="icon is-small ml-1">
														<ArrowUpDown size={12} />
													</span>
												{/if}
											</button>
											<button
												class="button is-small"
												class:is-info={sortBy === "author"}
												on:click={() => toggleSort("author")}
											>
												Author
												{#if sortBy === "author"}
													<span class="icon is-small ml-1">
														<ArrowUpDown size={12} />
													</span>
												{/if}
											</button>
										</div>
									</div>
								</div>
							</div>
						</div>

						{#if loadingRecordings}
							<div class="notification is-light">
								<div class="button is-loading is-ghost">Loading recordings...</div>
							</div>
						{:else if filteredAndSortedRecordings.length === 0}
							<div class="notification is-warning is-light">
								<p>No recordings match your criteria.</p>
							</div>
						{:else}
							<div
								class="recording-list available-list"
								role="listbox"
								aria-label="Available recordings"
							>
								{#each filteredAndSortedRecordings as recording (recording.id)}
									<div
										class="recording-item draggable"
										role="option"
										aria-selected="false"
										tabindex="0"
										on:dblclick={() => addRecording(recording.id)}
										on:keydown={(e) => e.key === "Enter" && addRecording(recording.id)}
										animate:flip={{ duration: 200 }}
										use:draggable={{
											dragData: {
												id: recording.id,
												type: "available-recording",
												data: recording,
											},
										}}
									>
										<div class="recording-content">
											<strong>{recording.title || "Untitled"}</strong>
											{#if recording.author}
												<span class="has-text-grey"> - {recording.author}</span>
											{/if}
											<span class="has-text-grey-light ml-2">
												({formatDuration(recording.duration)})
											</span>
											{#if recording.type}
												<span
													class="tag is-small ml-2"
													class:is-info={recording.type === "music"}
													class:is-success={recording.type === "news"}
													class:is-warning={recording.type === "talk" ||
														recording.type === "talkshow" ||
														recording.type === "interview"}
													class:is-primary={recording.type === "commentary"}
													class:is-link={recording.type === "comedy"}
													class:is-light={recording.type === "unknown" ||
														recording.type === "other"}
													class:is-dark={recording.type === "jingle" || recording.type === "poetry"}
												>
													{recording.type}
												</span>
											{/if}
										</div>
										<button
											type="button"
											class="button is-small is-success is-outlined add-button"
											on:click|stopPropagation={() => addRecording(recording.id)}
											title="Add to program"
										>
											Add
										</button>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Selected Recordings Panel -->
					<div class="listbox-panel">
						<div class="panel-header">
							<div class="level is-mobile">
								<div class="level-left">
									<h3 class="subtitle is-6 mb-0">
										Program Recordings ({selectedRecordings.length})
									</h3>
								</div>
								<div class="level-right">
									<span class="tag is-info">Total: {getTotalDuration()}</span>
								</div>
							</div>
						</div>

						{#if loadingRecordings}
							<div class="recording-list selected-list">
								<div class="notification is-light">
									<div class="button is-loading is-ghost">Loading program recordings...</div>
								</div>
							</div>
						{:else if selectedRecordings.length === 0}
							<div
								class="recording-list selected-list empty"
								bind:this={selectedListRef}
								role="listbox"
								aria-label="Selected recordings"
								use:dropzone={{
									onDrop: handleDropOnSelected,
									acceptTypes: ["available-recording"],
								}}
							>
								<div class="notification is-info is-light">
									<p>Drag recordings here or click "Add" to build your program.</p>
								</div>
							</div>
						{:else}
							<div
								class="recording-list selected-list"
								bind:this={selectedListRef}
								role="listbox"
								aria-label="Selected recordings"
								use:sortable={{
									items: selectedRecordings,
									onSort: handleSortableSort,
								}}
								use:dropzone={{
									onDrop: handleDropOnSelected,
									acceptTypes: ["available-recording"],
								}}
							>
								{#each selectedRecordings as item, index (item.uniqueKey)}
									{@const recording = getRecordingInfo(item.id)}
									<div
										class="recording-item selected-item"
										class:recording-not-found={!recording}
										animate:flip={{ duration: 200 }}
										data-sortable-item={item.uniqueKey}
									>
										<div class="recording-content">
											<span class="has-text-weight-semibold mr-2">{index + 1}.</span>
											{#if loadingRecordings}
												<span class="has-text-grey-light">Loading...</span>
											{:else if !recording}
												<span class="has-text-danger">
													<span class="icon is-small">
														<AlertCircle size={14} />
													</span>
													<span>Recording not found</span>
												</span>
												<span class="has-text-grey-light ml-2">
													(This recording may have been deleted or marked as not OK)
												</span>
											{:else}
												<strong>{recording.title || "Untitled"}</strong>
												{#if recording.author}
													<span class="has-text-grey"> - {recording.author}</span>
												{/if}
												<span class="has-text-grey-light ml-2">
													({formatDuration(recording.duration)})
												</span>
											{/if}
										</div>
										<div class="buttons has-addons">
											<button
												type="button"
												class="button is-small"
												on:click={() => moveRecording(index, "up")}
												disabled={index === 0 || loading}
												title="Move up"
											>
												<span class="icon is-small">
													<ChevronUp size={14} />
												</span>
											</button>
											<button
												type="button"
												class="button is-small"
												on:click={() => moveRecording(index, "down")}
												disabled={index === selectedRecordings.length - 1 || loading}
												title="Move down"
											>
												<span class="icon is-small">
													<ChevronDown size={14} />
												</span>
											</button>
											<button
												type="button"
												class="button is-small is-danger is-outlined"
												on:click={() => removeRecording(item.uniqueKey)}
												disabled={loading}
												title="Remove from program"
											>
												<span class="icon is-small">
													<X size={14} />
												</span>
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</section>
		<footer class="modal-card-foot">
			<button
				class="button is-success"
				on:click={handleSave}
				class:is-loading={loading}
				disabled={loading}
			>
				Save Recordings
			</button>
			<button class="button" on:click={handleClose} disabled={loading}>Cancel</button>
		</footer>
	</div>
</div>

<style>
	.modal-card {
		width: 95%;
		max-width: 1200px;
	}

	.modal-card-body {
		max-height: calc(100vh - 200px);
		overflow-y: auto;
	}

	.dual-listbox {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		min-height: 500px;
	}

	.listbox-panel {
		display: flex;
		flex-direction: column;
		border: 1px solid #dbdbdb;
		border-radius: 4px;
		background: #fafafa;
		padding: 1rem;
	}

	.panel-header {
		margin-bottom: 1rem;
	}

	.controls {
		margin-top: 0.5rem;
	}

	.recording-list {
		flex: 1;
		overflow-y: auto;
		background: white;
		border: 1px solid #dbdbdb;
		border-radius: 4px;
		padding: 0.5rem;
		min-height: 350px;
		max-height: 500px;
		position: relative;
	}

	.recording-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem;
		margin-bottom: 0.5rem;
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 4px;
		cursor: move;
		transition: all 0.2s;
		user-select: none;
	}

	.recording-item:hover {
		background-color: #f5f5f5;
		border-color: #3273dc;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.recording-item.draggable {
		position: relative;
	}

	:global(.recording-item.dragging) {
		opacity: 0.5;
	}

	.recording-item:active {
		cursor: grabbing;
	}

	.recording-content {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-right: 0.5rem;
	}

	.add-button {
		flex-shrink: 0;
	}

	.selected-item {
		background-color: #f0f8ff;
		border-color: #3273dc;
	}

	.selected-item.recording-not-found {
		background-color: #fff5f5;
		border-color: #f14668;
	}

	.selected-item:hover {
		background-color: #e8f2ff;
	}

	.selected-list {
		transition: all 0.2s;
	}

	.selected-list.empty {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	:global(.selected-list.drag-over) {
		background-color: #e8f2ff;
		border-color: #3273dc;
		border-width: 2px;
		box-shadow: inset 0 0 10px rgba(50, 115, 220, 0.1);
	}

	/* Sortable placeholder */
	:global(.sortable-placeholder) {
		background-color: #f0f8ff;
		border: 2px dashed #3273dc;
		border-radius: 4px;
		margin-bottom: 0.5rem;
	}

	@media (max-width: 768px) {
		.dual-listbox {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.modal-card {
			width: 100%;
			margin: 0;
		}

		.recording-list {
			max-height: 300px;
		}
	}

	/* Drag ghost styling */
	.recording-item.draggable {
		cursor: move;
	}

	.recording-item.draggable:active {
		cursor: grabbing;
	}
</style>
