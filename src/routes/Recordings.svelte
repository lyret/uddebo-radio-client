<script lang="ts">
	import { onMount } from "svelte";
	import { push } from "svelte-spa-router";
	import {
		Edit2,
		ChevronUp,
		ChevronDown,
		FileAudio,
		Play,
		Pause,
		Info,
		ExternalLink,
	} from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import type { Recording } from "@/api";
	import Layout from "@/components/Layout.svelte";
	import RecordingEditorModal from "@/components/RecordingEditorModal.svelte";
	import { supabase, isAdmin } from "@/api";

	let recordings: Recording[] = [];
	let loading = true;
	let sortField: keyof Recording = "edited_at";
	let sortOrder: "asc" | "desc" = "desc";
	let playingId: string | null = null;
	let audioElement: HTMLAudioElement;
	let filterStatus: "ok" | "not_ok" | "all" = "ok";
	let filterType: string = "all";
	let editingRecording: Recording | null = null;
	let isEditorOpen = false;
	// All possible recording types
	const recordingTypes = [
		"unknown",
		"jingle",
		"poetry",
		"music",
		"news",
		"commentary",
		"talk",
		"comedy",
		"talkshow",
		"interview",
		"other",
	];

	onMount(() => {
		loadRecordings();
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

	function formatDateTime(dateString: string | null) {
		if (!dateString) return "N/A";
		return new Date(dateString).toLocaleString();
	}

	function formatDuration(seconds: number) {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	}

	$: getSortIcon = (field: keyof Recording) => {
		if (sortField !== field) {
			return null;
		}
		return sortOrder === "asc" ? ChevronUp : ChevronDown;
	};

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

	function handleEditorUpdate(event: CustomEvent) {
		const detail = event.detail;

		// If status changed and we're filtering by status (not "all")
		if (detail?.changedStatus && filterStatus !== "all") {
			// If changed to "ok" and we're showing "not_ok", switch to "ok"
			if (detail.newStatus === "ok" && filterStatus === "not_ok") {
				filterStatus = "ok";
			}
			// If changed to "not_ok" and we're showing "ok", switch to "not_ok"
			else if (detail.newStatus === "not_ok" && filterStatus === "ok") {
				filterStatus = "not_ok";
			}
		}

		// If type changed and we're filtering by a specific type
		if (detail?.changedType && filterType !== "all") {
			// Reset type filter to "all" since the recording's type changed
			filterType = detail.changedType;
		}

		loadRecordings();
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
									{#each recordingTypes as type}
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
								<th>Cover</th>
								<th>
									<button class="button is-ghost" on:click={() => sortBy("title")}>
										Title
										{#if getSortIcon("title")}
											<span class="icon is-small pl-2">
												<svelte:component this={getSortIcon("title")} size={14} />
											</span>
										{/if}
									</button>
								</th>
								<th>
									<button class="button is-ghost" on:click={() => sortBy("author")}>
										Author
										{#if getSortIcon("author")}
											<span class="icon is-small pl-2">
												<svelte:component this={getSortIcon("author")} size={14} />
											</span>
										{/if}
									</button>
								</th>
								<th>
									<button class="button is-ghost" on:click={() => sortBy("type")}>
										Type
										{#if getSortIcon("type")}
											<span class="icon is-small pl-2">
												<svelte:component this={getSortIcon("type")} size={14} />
											</span>
										{/if}
									</button>
								</th>
								<th>
									<button class="button is-ghost" on:click={() => sortBy("duration")}>
										Duration
										{#if getSortIcon("duration")}
											<span class="icon is-small pl-2">
												<svelte:component this={getSortIcon("duration")} size={14} />
											</span>
										{/if}
									</button>
								</th>
								<th>
									<button class="button is-ghost" on:click={() => sortBy("edited_at")}>
										Last Edited
										{#if getSortIcon("edited_at")}
											<span class="icon is-small pl-2">
												<svelte:component this={getSortIcon("edited_at")} size={14} />
											</span>
										{/if}
									</button>
								</th>
								<th colspan="3" />
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
									<td>
										{#if recording.cover_url}
											<figure class="image is-48x48">
												<img src={recording.cover_url} alt="{recording.title} cover" />
											</figure>
										{:else}
											<figure class="image is-48x48">
												<div class="placeholder-cover">
													<span class="icon">
														<FileAudio size={24} />
													</span>
												</div>
											</figure>
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
									<td>
										<small>{formatDateTime(recording.edited_at || recording.uploaded_at)}</small>
									</td>
									<td>
										<div class="info-icons">
											{#if recording.description}
												<button
													class="icon-button"
													title={recording.description}
													on:click={() => toast.info(recording.description, { duration: 5000 })}
												>
													<span class="icon">
														<Info size={16} />
													</span>
												</button>
											{/if}
											{#if recording.link_out_url}
												<button
													class="icon-button"
													title={recording.link_out_url}
													on:click={() => toast.info(recording.link_out_url, { duration: 5000 })}
												>
													<span class="icon">
														<ExternalLink size={16} />
													</span>
												</button>
											{/if}
										</div>
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
			on:deleted={handleEditorUpdate}
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

	.info-icons {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.icon-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		color: #3273dc;
		transition: color 0.2s;
	}

	.icon-button:hover {
		color: #2366d1;
	}
</style>
