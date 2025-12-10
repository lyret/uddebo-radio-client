<script lang="ts">
	import { onMount } from "svelte";
	import { push } from "svelte-spa-router";
	import { Edit2, ChevronUp, ChevronDown, FileAudio, Play, Pause, Trash2 } from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import type { Recording } from "@/api";
	import Layout from "@/components/Layout.svelte";
	import RecordingEditorModal from "@/components/RecordingEditorModal.svelte";
	import { supabase, isAdmin } from "@/api";

	let recordings: Recording[] = [];
	let loading = true;
	let sortField: keyof Recording = "uploaded_at";
	let sortOrder: "asc" | "desc" = "desc";
	let playingId: string | null = null;
	let audioElement: HTMLAudioElement;
	let filterStatus: "ok" | "not_ok" | "all" = "ok";
	let filterType: string = "all";
	let editingRecording: Recording | null = null;
	let isEditorOpen = false;
	let availableTypes: string[] = [];

	onMount(() => {
		loadRecordings();
		loadAvailableTypes();
	});

	async function loadRecordings() {
		try {
			let query = supabase.from("recordings").select("*");

			// Apply filter based on okey_at status
			if (filterStatus === "ok") {
				query = query.not("okey_at", "is", null);
			} else if (filterStatus === "not_ok") {
				query = query.is("okey_at", null);
			}
			// 'all' shows everything without filter

			// Apply type filter
			if (filterType !== "all") {
				query = query.eq("type", filterType);
			}

			const { data, error } = await query.order(sortField, {
				ascending: sortOrder === "asc",
			});

			if (error) throw error;
			recordings = data || [];
		} catch (error) {
			toast.error("Failed to load recordings");
			console.error(error);
		} finally {
			loading = false;
		}
	}

	function sortBy(field: keyof Recording) {
		if (sortField === field) {
			sortOrder = sortOrder === "asc" ? "desc" : "asc";
		} else {
			sortField = field;
			sortOrder = "asc";
		}
		loadRecordings();
	}

	async function deleteRecording(id: string) {
		if (!confirm("Are you sure you want to delete this recording? This action cannot be undone."))
			return;

		try {
			const { error } = await supabase.from("recordings").delete().eq("id", id);

			if (error) throw error;

			toast.success("Recording deleted successfully");
			loadRecordings();
		} catch (error) {
			toast.error("Failed to delete recording");
			console.error(error);
		}
	}

	function formatDateTime(dateString: string | null) {
		if (!dateString) return "N/A";
		return new Date(dateString).toLocaleString();
	}

	function formatDuration(seconds: number) {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	}

	function formatFileSize(bytes: number) {
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(2)} MB`;
	}

	function getSortIcon(field: keyof Recording) {
		if (sortField !== field) return null;
		return sortOrder === "asc" ? ChevronUp : ChevronDown;
	}

	function togglePlay(recording: Recording) {
		if (playingId === recording.id) {
			audioElement.pause();
			playingId = null;
		} else {
			playingId = recording.id;
			audioElement.src = recording.file_url;
			audioElement.play();
		}
	}

	function handleAudioEnded() {
		playingId = null;
	}

	function openEditor(recording: Recording) {
		editingRecording = recording;
		isEditorOpen = true;
	}

	function handleEditorClose() {
		editingRecording = null;
		isEditorOpen = false;
	}

	function handleEditorUpdate() {
		loadRecordings();
	}

	async function loadAvailableTypes() {
		try {
			// Get all unique recording types from the database
			const { data, error } = await supabase
				.from("recordings")
				.select("type")
				.not("type", "is", null);

			if (error) throw error;

			// Extract unique types
			const types = Array.from(new Set(data?.map((r) => r.type).filter(Boolean) || []));
			availableTypes = types.sort();
		} catch (error) {
			console.error("Failed to load recording types:", error);
		}
	}

	// Redirect to home if not admin
	$: if (!$isAdmin) {
		push("/");
	}
</script>

{#if $isAdmin}
	<Layout fullWidth={true}>
		<div class="recordings-management">
			<div class="level">
				<div class="level-left">
					<h2 class="title is-4">
						<span class="icon">
							<FileAudio />
						</span>
						Recordings Management
					</h2>
				</div>
				<div class="level-right">
					<div class="field has-addons">
						<div class="control">
							<span class="button is-static">Status:</span>
						</div>
						<div class="control">
							<div class="select">
								<select bind:value={filterStatus} on:change={loadRecordings}>
									<option value="ok">OK</option>
									<option value="not_ok">Not OK</option>
									<option value="all">All</option>
								</select>
							</div>
						</div>
						<div class="control">
							<span class="button is-static">Type:</span>
						</div>
						<div class="control">
							<div class="select">
								<select bind:value={filterType} on:change={loadRecordings}>
									<option value="all">All Types</option>
									{#each availableTypes as type}
										<option value={type}>{type}</option>
									{/each}
								</select>
							</div>
						</div>
						<div class="control">
							<span class="button is-static">{recordings.length} recordings</span>
						</div>
					</div>
				</div>
			</div>

			{#if loading}
				<div class="has-text-centered p-6">
					<div class="button is-loading is-large is-ghost"></div>
					<p class="mt-4">Loading recordings...</p>
				</div>
			{:else if recordings.length === 0}
				<div class="notification is-info is-light">
					<p>No recordings found. Upload some recordings to get started!</p>
				</div>
			{:else}
				<div class="table-container">
					<table class="table is-fullwidth is-striped is-hoverable">
						<thead>
							<tr>
								<th>Status</th>
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
									<button class="button is-ghost" on:click={() => sortBy("author")}>
										Author
										{#if getSortIcon("author")}
											<span class="icon is-small">
												<svelte:component this={getSortIcon("author")} size={14} />
											</span>
										{/if}
									</button>
								</th>
								<th>
									<button class="button is-ghost" on:click={() => sortBy("type")}>
										Type
										{#if getSortIcon("type")}
											<span class="icon is-small">
												<svelte:component this={getSortIcon("type")} size={14} />
											</span>
										{/if}
									</button>
								</th>
								<th>
									<button class="button is-ghost" on:click={() => sortBy("duration")}>
										Duration
										{#if getSortIcon("duration")}
											<span class="icon is-small">
												<svelte:component this={getSortIcon("duration")} size={14} />
											</span>
										{/if}
									</button>
								</th>
								<th>
									<button class="button is-ghost" on:click={() => sortBy("file_size")}>
										Size
										{#if getSortIcon("file_size")}
											<span class="icon is-small">
												<svelte:component this={getSortIcon("file_size")} size={14} />
											</span>
										{/if}
									</button>
								</th>
								<th>
									<button class="button is-ghost" on:click={() => sortBy("uploaded_at")}>
										Uploaded
										{#if getSortIcon("uploaded_at")}
											<span class="icon is-small">
												<svelte:component this={getSortIcon("uploaded_at")} size={14} />
											</span>
										{/if}
									</button>
								</th>
								<th>Description</th>
								<th>Link</th>
								<th>Play</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each recordings as recording (recording.id)}
								<tr>
									<td>
										{#if recording.okey_at}
											<span class="tag is-success">OK</span>
										{:else}
											<span class="tag is-warning">Not OK</span>
										{/if}
									</td>
									<td>{recording.title || "Untitled"}</td>
									<td>{recording.author || "-"}</td>
									<td>
										<span
											class="tag is-small"
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
									</td>
									<td>{formatDuration(recording.duration)}</td>
									<td>{formatFileSize(recording.file_size)}</td>
									<td>
										<small>{formatDateTime(recording.uploaded_at)}</small>
									</td>
									<td>
										<small
											>{recording.description?.substring(0, 50) || "-"}{recording.description &&
											recording.description.length > 50
												? "..."
												: ""}</small
										>
									</td>
									<td>
										{#if recording.link_out_url}
											<a
												href={recording.link_out_url}
												target="_blank"
												rel="noopener noreferrer"
												class="has-text-link"
											>
												Link
											</a>
										{:else}
											-
										{/if}
									</td>
									<td>
										<button
											class="button is-small"
											on:click={() => togglePlay(recording)}
											title={playingId === recording.id ? "Pause" : "Play"}
										>
											<span class="icon">
												{#if playingId === recording.id}
													<Pause size={16} />
												{:else}
													<Play size={16} />
												{/if}
											</span>
										</button>
									</td>
									<td>
										<div class="buttons are-small">
											<button
												class="button is-primary is-small"
												title="Edit Recording"
												on:click={() => openEditor(recording)}
											>
												<span class="icon">
													<Edit2 size={16} />
												</span>
												<span>Edit</span>
											</button>
											<button
												class="button is-danger is-small"
												on:click={() => deleteRecording(recording.id)}
												title="Delete Recording"
											>
												<span class="icon">
													<Trash2 size={16} />
												</span>
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

		<!-- Hidden audio element for playback -->
		<audio bind:this={audioElement} on:ended={handleAudioEnded} />

		<!-- Recording Editor Modal -->
		<RecordingEditorModal
			recording={editingRecording}
			bind:isOpen={isEditorOpen}
			on:close={handleEditorClose}
			on:updated={handleEditorUpdate}
		/>
	</Layout>
{/if}

<style>
	.table-container {
		overflow-x: auto;
	}

	.recordings-management {
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
</style>
