<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { FileAudio, Music, ChevronUp, ChevronDown } from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import type { BroadcastProgram, Recording } from "@/api";
	import { supabase } from "@/api";

	export let program: BroadcastProgram | null = null;
	export let isOpen = false;

	const dispatch = createEventDispatcher();

	let selectedRecordings: string[] = [];
	let recordings: Recording[] = [];
	let loading = false;
	let loadingRecordings = true;

	$: if (isOpen && program) {
		loadFormData();
		loadRecordings();
	}

	function loadFormData() {
		if (!program) return;
		selectedRecordings = Array.isArray(program.recordings) ? [...program.recordings] : [];
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
			recordings = data || [];
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

			const { error } = await supabase
				.from("broadcast_programs")
				.update({
					recordings: selectedRecordings,
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

	function toggleRecording(recordingId: string) {
		if (selectedRecordings.includes(recordingId)) {
			selectedRecordings = selectedRecordings.filter((id) => id !== recordingId);
		} else {
			selectedRecordings = [...selectedRecordings, recordingId];
		}
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

	function getRecordingTitle(recordingId: string) {
		const recording = recordings.find((r) => r.id === recordingId);
		return recording?.title || "Untitled Recording";
	}

	function getRecordingInfo(recordingId: string) {
		return recordings.find((r) => r.id === recordingId);
	}

	function formatDuration(seconds: number) {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	}

	function getTotalDuration() {
		const total = selectedRecordings.reduce((sum, recordingId) => {
			const recording = recordings.find((r) => r.id === recordingId);
			return sum + (recording?.duration || 0);
		}, 0);
		return formatDuration(total);
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
					<p class="help">Add and arrange recordings for this broadcast program.</p>
				</div>

				{#if selectedRecordings.length > 0}
					<div class="box mb-4">
						<div class="level is-mobile">
							<div class="level-left">
								<h3 class="subtitle is-6 mb-0">
									Selected Recordings ({selectedRecordings.length})
								</h3>
							</div>
							<div class="level-right">
								<span class="tag is-info">Total: {getTotalDuration()}</span>
							</div>
						</div>
						<hr class="my-3" />
						{#each selectedRecordings as recordingId, index}
							{@const recording = getRecordingInfo(recordingId)}
							<div class="level is-mobile recording-item">
								<div class="level-left">
									<div>
										<span class="has-text-weight-semibold mr-2">{index + 1}.</span>
										<span>{recording?.title || "Untitled"}</span>
										{#if recording?.author}
											<span class="has-text-grey"> - {recording.author}</span>
										{/if}
										{#if recording}
											<span class="has-text-grey-light ml-2">
												({formatDuration(recording.duration)})
											</span>
										{/if}
									</div>
								</div>
								<div class="level-right">
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
											on:click={() => toggleRecording(recordingId)}
											disabled={loading}
											title="Remove from program"
										>
											Remove
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="notification is-info is-light mb-4">
						<p>No recordings selected yet. Choose from the available recordings below.</p>
					</div>
				{/if}

				<div class="field">
					<p class="label">
						<span class="icon is-small">
							<FileAudio size={16} />
						</span>
						Available Recordings
					</p>
					{#if loadingRecordings}
						<div class="notification is-light">
							<div class="button is-loading is-ghost">Loading recordings...</div>
						</div>
					{:else if recordings.length === 0}
						<div class="notification is-warning is-light">
							<p>No approved recordings available. Upload and approve some recordings first.</p>
						</div>
					{:else}
						<div class="box recording-selection">
							{#each recordings as recording}
								{#if !selectedRecordings.includes(recording.id)}
									<label class="checkbox is-block recording-checkbox">
										<input
											type="checkbox"
											on:change={() => toggleRecording(recording.id)}
											disabled={loading}
										/>
										<span class="ml-2">
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
													class:is-light={recording.type === "unknown" || recording.type === "other"}
													class:is-dark={recording.type === "jingle" || recording.type === "poetry"}
												>
													{recording.type}
												</span>
											{/if}
										</span>
									</label>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</section>
		<footer class="modal-card-foot">
			<button class="button is-success" on:click={handleSave} class:is-loading={loading} disabled={loading}>
				Save Recordings
			</button>
			<button class="button" on:click={handleClose} disabled={loading}>Cancel</button>
		</footer>
	</div>
</div>

<style>
	.modal-card {
		width: 90%;
		max-width: 900px;
	}

	.recording-selection {
		max-height: 400px;
		overflow-y: auto;
	}

	.checkbox.is-block {
		display: block;
	}

	.modal-card-body {
		max-height: calc(100vh - 200px);
		overflow-y: auto;
	}

	.recording-item {
		padding: 0.5rem 0;
		border-bottom: 1px solid #f5f5f5;
	}

	.recording-item:last-child {
		border-bottom: none;
	}

	.recording-checkbox {
		padding: 0.5rem;
		margin-bottom: 0.5rem;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.recording-checkbox:hover {
		background-color: #f5f5f5;
	}
</style>
