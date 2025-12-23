<script lang="ts">
	import { createEventDispatcher, onDestroy } from "svelte";
	import {
		Music,
		ChevronUp,
		ChevronDown,
		X,
		ArrowUpDown,
		AlertCircle,
		Play,
		Pause,
	} from "lucide-svelte";
	import { toast } from "svelte-sonner";

	import type { BroadcastProgram, Recording } from "@/api";
	import { supabase } from "@/api";
	import { draggable, dropzone, sortable, arrayMove, type DragData } from "@/api/dndWrapper";
	import { getSwedishRecordingType } from "@/api/lang";

	export let program: BroadcastProgram | null = null;
	export let isOpen = false;

	const dispatch = createEventDispatcher();

	let selectedRecordings: Array<{ id: string; uniqueKey: string }> = [];
	let allRecordings: Recording[] = [];
	let loading = false;
	let loadingRecordings = true;

	// Filter and sort state
	let filterType = "all";
	let sortBy: "title" | "edited_at" | "author" = "title";
	let sortOrder: "asc" | "desc" = "asc";
	let searchQuery = "";

	// Audio playback state
	let currentlyPlaying: string | null = null;
	let audioElements: Record<string, HTMLAudioElement> = {};
	let playbackProgress: Record<string, number> = {};
	let audioDurations: Record<string, number> = {};

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
					aVal = a.edited_at || a.uploaded_at || "";
					bVal = b.edited_at || b.uploaded_at || "";
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
					id: id as string,
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
			toast.error("Kunde inte ladda inspelningar");
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

			toast.success("Programmets inspelningar uppdaterades");
			dispatch("updated");
			handleClose();
		} catch (error) {
			toast.error("Kunde inte uppdatera programmets inspelningar");
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

	$: totalDuration = (() => {
		const total = selectedRecordings.reduce((sum, item) => {
			const recording = getRecordingInfo(item.id);
			return sum + (recording?.duration || 0);
		}, 0);
		return formatDuration(total);
	})();

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
	function handleDropOnSelected(dragData: DragData, dropIndex?: number) {
		if (dragData.type === "available-recording") {
			const newItem = {
				id: dragData.id,
				uniqueKey: String(Date.now()),
			};

			if (dropIndex !== undefined && dropIndex >= 0) {
				// Insert at specific position
				selectedRecordings = [
					...selectedRecordings.slice(0, dropIndex),
					newItem,
					...selectedRecordings.slice(dropIndex),
				];
			} else {
				// Add to end
				selectedRecordings = [...selectedRecordings, newItem];
			}
		}
	}

	function handleSortableSort(fromIndex: number, toIndex: number) {
		selectedRecordings = arrayMove(selectedRecordings, fromIndex, toIndex);
	}

	// Audio playback functions
	function toggleAudioPlayback(recordingId: string, fileUrl: string) {
		if (currentlyPlaying === recordingId) {
			// Pause current audio
			if (audioElements[recordingId]) {
				audioElements[recordingId].pause();
				currentlyPlaying = null;
			}
		} else {
			// Stop any currently playing audio
			if (currentlyPlaying && audioElements[currentlyPlaying]) {
				audioElements[currentlyPlaying].pause();
				audioElements[currentlyPlaying].currentTime = 0;
				playbackProgress[currentlyPlaying] = 0;
			}

			// Create or get audio element
			if (!audioElements[recordingId]) {
				const audio = new Audio(fileUrl);
				audioElements[recordingId] = audio;

				// Set up event listeners
				audio.addEventListener("timeupdate", () => {
					if (audio.duration) {
						playbackProgress[recordingId] = (audio.currentTime / audio.duration) * 100;
						playbackProgress = { ...playbackProgress };
					}
				});

				audio.addEventListener("loadedmetadata", () => {
					audioDurations[recordingId] = audio.duration;
					audioDurations = { ...audioDurations };
				});

				audio.addEventListener("ended", () => {
					currentlyPlaying = null;
					playbackProgress[recordingId] = 0;
					playbackProgress = { ...playbackProgress };
				});

				audio.addEventListener("error", (e) => {
					console.error("Audio playback error:", e);
					toast.error("Kunde inte spela upp ljudfilen");
					currentlyPlaying = null;
				});
			}

			// Play the audio
			audioElements[recordingId].play().catch((error) => {
				console.error("Failed to play audio:", error);
				toast.error("Kunde inte starta uppspelning");
			});
			currentlyPlaying = recordingId;
		}
	}

	function seekAudio(recordingId: string, event: MouseEvent) {
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const percentage = x / rect.width;

		if (audioElements[recordingId]) {
			audioElements[recordingId].currentTime =
				percentage * (audioDurations[recordingId] || audioElements[recordingId].duration);
		}
	}

	function formatTime(seconds: number): string {
		if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	}

	// Cleanup audio elements on destroy
	onDestroy(() => {
		Object.values(audioElements).forEach((audio) => {
			audio.pause();
			audio.src = "";
		});
		audioElements = {};
	});
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
				<span>Hantera programsättning för {program?.title || "?"}</span>
			</p>
			<button class="delete" aria-label="close" on:click={handleClose} disabled={loading}></button>
		</header>
		<section class="modal-card-body">
			{#if program}
				<div class="mb-4">
					<p class="help">
						Dra inspelningar från den vänstra panelen för att lägga till dem i programmet. Ändra
						ordning genom att dra inom den högra panelen.
					</p>
				</div>

				<div class="dual-listbox">
					<!-- Available Recordings Panel -->
					<div class="listbox-panel">
						<div class="panel-header">
							<h3 class="subtitle is-6 mb-2">Tillgängliga inspelningar</h3>
							<div class="controls">
								<!-- Search -->
								<div class="field has-addons mb-2">
									<div class="control is-expanded">
										<input
											class="input is-small"
											type="text"
											placeholder="Sök inspelningar..."
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
														{type === "all" ? "Alla typer" : getSwedishRecordingType(type)}
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
												Titel
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
												Datum
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
												Artist
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
								<div class="button is-loading is-ghost">Laddar inspelningar...</div>
							</div>
						{:else if filteredAndSortedRecordings.length === 0}
							<div class="notification is-warning is-light">
								<p>Inga inspelningar matchar dina sökkriterier.</p>
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
													{getSwedishRecordingType(recording.type)}
												</span>
											{/if}
										</div>
										<div class="recording-actions">
											<button
												type="button"
												class="button is-small audio-control-button"
												on:click|stopPropagation={() =>
													toggleAudioPlayback(recording.id.toString(), recording.file_url)}
												title={currentlyPlaying === recording.id.toString() ? "Pausa" : "Spela upp"}
											>
												<span class="icon">
													{#if currentlyPlaying === recording.id.toString()}
														<Pause size={14} />
													{:else}
														<Play size={14} />
													{/if}
												</span>
											</button>
											<button
												type="button"
												class="button is-small is-success is-outlined add-button"
												on:click|stopPropagation={() => addRecording(recording.id)}
												title="Lägg till i program"
											>
												Lägg till
											</button>
										</div>
										{#if currentlyPlaying === recording.id.toString()}
											<div
												class="audio-progress-bar"
												role="slider"
												aria-label="Ljuduppspelning"
												aria-valuemin="0"
												aria-valuemax="100"
												aria-valuenow={Math.round(playbackProgress[recording.id.toString()] || 0)}
												tabindex="0"
												on:click={(e) => seekAudio(recording.id.toString(), e)}
												on:keydown={(e) => {
													if (e.key === "ArrowLeft") {
														e.preventDefault();
														const audio = audioElements[recording.id.toString()];
														if (audio) audio.currentTime = Math.max(0, audio.currentTime - 5);
													} else if (e.key === "ArrowRight") {
														e.preventDefault();
														const audio = audioElements[recording.id.toString()];
														if (audio)
															audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
													}
												}}
											>
												<div
													class="progress-fill"
													style="width: {playbackProgress[recording.id.toString()] || 0}%"
												></div>
												<div class="progress-time">
													{formatTime(audioElements[recording.id.toString()]?.currentTime || 0)} / {formatTime(
														audioDurations[recording.id.toString()] || recording.duration
													)}
												</div>
											</div>
										{/if}
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
										Valda inspelningar ({selectedRecordings.length})
									</h3>
								</div>
								<div class="level-right">
									<span class="tag is-info">Total: {totalDuration}</span>
								</div>
							</div>
						</div>

						{#if loadingRecordings}
							<div class="recording-list selected-list">
								<div class="notification is-light">
									<div class="button is-loading is-ghost">Laddar programmets inspelningar...</div>
								</div>
							</div>
						{:else if selectedRecordings.length === 0}
							<div
								class="recording-list selected-list empty"
								role="listbox"
								aria-label="Selected recordings"
								use:dropzone={{
									onDrop: handleDropOnSelected,
									acceptTypes: ["available-recording"],
								}}
							>
								<div class="notification is-light">
									<p>Dra inspelningar hit eller klicka "Lägg till" för att bygga programmet.</p>
								</div>
							</div>
						{:else}
							<div
								class="recording-list selected-list"
								use:sortable={{
									items: selectedRecordings,
									onSort: handleSortableSort,
									onDrop: handleDropOnSelected,
									acceptTypes: ["available-recording"],
								}}
							>
								{#each selectedRecordings as item, index (item.uniqueKey)}
									{@const recording = getRecordingInfo(item.id)}
									<div
										class="recording-item selected-item"
										class:recording-not-found={!recording}
										data-sortable-item={item.uniqueKey}
									>
										<div class="recording-content">
											{#if loadingRecordings}
												<span class="has-text-grey-light">Laddar...</span>
											{:else if !recording}
												<span class="has-text-danger">
													<span class="icon is-small">
														<AlertCircle size={14} />
													</span>
													<span>Inspelning hittades inte</span>
												</span>
												<span class="has-text-grey-light ml-2">
													(Denna inspelning kan ha tagits bort eller markerats som ej OK)
												</span>
											{:else}
												<strong>{recording.title || "Namnlös"}</strong>
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
														class:is-dark={recording.type === "jingle" ||
															recording.type === "poetry"}
													>
														{getSwedishRecordingType(recording.type)}
													</span>
												{/if}
											{/if}
										</div>
										{#if recording && recording.file_url}
											<button
												type="button"
												class="button is-small audio-control-button"
												on:click|stopPropagation={() =>
													toggleAudioPlayback(item.id.toString(), recording.file_url)}
												title={currentlyPlaying === item.id.toString() ? "Pausa" : "Spela upp"}
											>
												<span class="icon">
													{#if currentlyPlaying === item.id.toString()}
														<Pause size={14} />
													{:else}
														<Play size={14} />
													{/if}
												</span>
											</button>
										{/if}
										<div class="buttons has-addons">
											<button
												type="button"
												class="button is-small"
												on:click={() => moveRecording(index, "up")}
												disabled={index === 0 || loading}
												title="Flytta upp"
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
												title="Flytta ner"
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
												title="Ta bort från program"
											>
												<span class="icon is-small">
													<X size={14} />
												</span>
											</button>
										</div>
										{#if recording && currentlyPlaying === item.id.toString()}
											<div
												class="audio-progress-bar selected"
												role="slider"
												aria-label="Ljuduppspelning"
												aria-valuemin="0"
												aria-valuemax="100"
												aria-valuenow={Math.round(playbackProgress[item.id.toString()] || 0)}
												tabindex="0"
												on:click={(e) => seekAudio(item.id.toString(), e)}
												on:keydown={(e) => {
													if (e.key === "ArrowLeft") {
														e.preventDefault();
														const audio = audioElements[item.id.toString()];
														if (audio) audio.currentTime = Math.max(0, audio.currentTime - 5);
													} else if (e.key === "ArrowRight") {
														e.preventDefault();
														const audio = audioElements[item.id.toString()];
														if (audio)
															audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
													}
												}}
											>
												<div
													class="progress-fill"
													style="width: {playbackProgress[item.id.toString()] || 0}%"
												></div>
												<div class="progress-time">
													{formatTime(audioElements[item.id.toString()]?.currentTime || 0)} / {formatTime(
														audioDurations[item.id.toString()] || recording.duration
													)}
												</div>
											</div>
										{/if}
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
				class="button is-primary"
				on:click={handleSave}
				class:is-loading={loading}
				disabled={loading}
			>
				Spara inspelningar
			</button>
			<button class="button" on:click={handleClose} disabled={loading}>Avbryt</button>
		</footer>
	</div>
</div>

<style>
	:global(.modal.is-active .modal-card) {
		width: calc(100vw - 40px);
		max-width: 100%;
		margin: 20px;
		height: calc(100vh - 40px);
		max-height: calc(100vh - 40px);
	}

	.modal-card-body {
		max-height: calc(100vh - 160px);
		overflow-y: auto;
		padding: 1.5rem;
	}

	.dual-listbox {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		min-height: 400px;
		height: 100%;
	}

	.listbox-panel {
		display: flex;
		flex-direction: column;
		border: 1px solid #dbdbdb;
		border-radius: 4px;
		background: #fafafa;
		padding: 1rem;
		height: 100%;
		min-height: 0;
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
		padding: 0.75rem;
		min-height: 0;
		position: relative;
	}

	.recording-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		padding: 0.75rem;
		margin-bottom: 0.5rem;
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 4px;
		cursor: move;
		transition: all 0.2s;
		user-select: none;
		position: relative;
	}

	.recording-item:hover {
		background-color: #f5f5f5;
		border-color: #3273dc;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.recording-item.draggable {
		cursor: grab;
	}

	:global(.recording-item.dragging) {
		opacity: 0.5;
	}

	.recording-item:active {
		cursor: grabbing;
	}

	.recording-content {
		flex: 1;
		min-width: 0;
		margin-right: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		overflow: hidden;
	}

	.recording-content > strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex-shrink: 1;
		min-width: 0;
	}

	.recording-content > span:not(.tag) {
		flex-shrink: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.recording-content .has-text-grey {
		max-width: 150px;
	}

	.recording-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-shrink: 0;
	}

	.add-button {
		flex-shrink: 0;
	}

	.audio-control-button {
		background: transparent;
		border-color: rgba(65, 205, 203, 0.3);
		color: #41cdcb;
	}

	.audio-control-button:hover {
		background: rgba(65, 205, 203, 0.1);
		border-color: #41cdcb;
		color: #41cdcb;
	}

	.audio-control-button:focus {
		box-shadow: 0 0 0 0.125rem rgba(65, 205, 203, 0.25);
	}

	.audio-progress-bar {
		width: 100%;
		height: 24px;
		background: rgba(65, 205, 203, 0.1);
		border: 1px solid rgba(65, 205, 203, 0.2);
		border-radius: 4px;
		position: relative;
		cursor: pointer;
		margin-top: 0.5rem;
		overflow: hidden;
		flex-basis: 100%;
	}

	.audio-progress-bar.selected {
		background: rgba(65, 205, 203, 0.15);
		border-color: rgba(65, 205, 203, 0.3);
	}

	.progress-fill {
		height: 100%;
		background: #41cdcb;
		border-radius: 4px;
		transition: width 0.1s;
		position: relative;
	}

	.progress-time {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-size: 0.75rem;
		color: #363636;
		font-weight: 600;
		pointer-events: none;
		text-shadow: 0 0 3px rgba(255, 255, 255, 0.9);
		letter-spacing: 0.5px;
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
		padding: 1rem;
		display: flex;
		align-items: center;
		min-height: 60px;
		opacity: 0.5;
	}

	@media (max-width: 1024px) {
		:global(.modal.is-active .modal-card) {
			width: 100%;
			margin: 0;
			height: 100vh;
			max-height: 100vh;
			border-radius: 0;
		}

		.modal-card-body {
			padding: 1rem;
			max-height: calc(100vh - 140px);
		}

		.dual-listbox {
			grid-template-columns: 1fr;
			gap: 1.5rem;
			min-height: 0;
		}

		.listbox-panel {
			height: auto;
			min-height: 350px;
		}

		.recording-list {
			max-height: 250px;
		}

		.recording-content .has-text-grey {
			max-width: 100px;
		}
	}

	@media (max-width: 640px) {
		.modal-card-body {
			padding: 0.75rem;
		}

		.recording-item {
			padding: 0.5rem;
			font-size: 0.9rem;
		}

		.recording-content {
			font-size: 0.9rem;
		}

		.audio-progress-bar {
			height: 20px;
		}

		.progress-time {
			font-size: 0.65rem;
		}

		.buttons.has-addons .button {
			padding: 0.25rem 0.5rem;
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
