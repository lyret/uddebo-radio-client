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
	import RecordingEditorModal from "@/modals/RecordingEditorModal.svelte";
	import { supabase } from "@/api";
	import { getSwedishRecordingType } from "@/api/lang";
	import { recordingsUIState } from "@/api/ui";

	let recordings: Recording[] = [];
	let loading = true;
	let playingId: string | null = null;
	let audioElement: HTMLAudioElement;
	let editingRecording: Recording | null = null;
	let isEditorOpen = false;
	// All possible recording types with Swedish labels
	const recordingTypes = [
		{ value: "unknown", label: "Okänd" },
		{ value: "jingle", label: "Jingel" },
		{ value: "poetry", label: "Poesi" },
		{ value: "music", label: "Musik" },
		{ value: "news", label: "Nyheter" },
		{ value: "commentary", label: "Kommentar" },
		{ value: "talk", label: "Tal" },
		{ value: "comedy", label: "Komedi" },
		{ value: "talkshow", label: "Pratshow" },
		{ value: "interview", label: "Intervju" },
		{ value: "other", label: "Övrigt" },
	];

	onMount(() => {
		loadRecordings();
	});

	async function loadRecordings() {
		try {
			let query = supabase.from("recordings").select("*");

			// Apply filter based on okey_at status
			if ($recordingsUIState.filterStatus === "ok") {
				query = query.not("okey_at", "is", null);
			} else if ($recordingsUIState.filterStatus === "not_ok") {
				query = query.is("okey_at", null);
			}
			// 'all' shows everything without filter

			// Apply type filter
			if ($recordingsUIState.filterType !== "all") {
				query = query.eq("type", $recordingsUIState.filterType);
			}

			const { data, error } = await query.order($recordingsUIState.sortField, {
				ascending: $recordingsUIState.sortOrder === "asc",
			});

			if (error) throw error;
			recordings = data || [];
		} catch (error) {
			toast.error("Kunde inte ladda inspelningar");
			console.error(error);
		} finally {
			loading = false;
		}
	}

	function sortBy(field: keyof Recording) {
		if ($recordingsUIState.sortField === field) {
			$recordingsUIState.sortOrder = $recordingsUIState.sortOrder === "asc" ? "desc" : "asc";
		} else {
			$recordingsUIState.sortField = field as
				| "edited_at"
				| "title"
				| "author"
				| "type"
				| "duration";
			$recordingsUIState.sortOrder = "asc";
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
		if ($recordingsUIState.sortField !== field) {
			return null;
		}
		return $recordingsUIState.sortOrder === "asc" ? ChevronUp : ChevronDown;
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
		if (detail?.changedStatus && $recordingsUIState.filterStatus !== "all") {
			// If changed to "ok" and we're showing "not_ok", switch to "ok"
			if (detail.newStatus === "ok" && $recordingsUIState.filterStatus === "not_ok") {
				$recordingsUIState.filterStatus = "ok";
			}
			// If changed to "not_ok" and we're showing "ok", switch to "not_ok"
			else if (detail.newStatus === "not_ok" && $recordingsUIState.filterStatus === "ok") {
				$recordingsUIState.filterStatus = "not_ok";
			}
		}

		// If type changed and we're filtering by a specific type
		if (detail?.changedType && $recordingsUIState.filterType !== "all") {
			// Reset type filter to "all" since the recording's type changed
			$recordingsUIState.filterType = detail.changedType;
		}

		loadRecordings();
	}
</script>

<Layout fullWidth={true} requiresAdmin={true}>
	<div class="recordings-management">
		<div class="level">
			<div class="level-left">
				<h2 class="title is-4">
					<span class="icon">
						<FileAudio />
					</span>
					Hantera inspelningar
				</h2>
			</div>
			<div class="level-right">
				<div class="field has-addons">
					<div class="control">
						<span class="button is-static">Status:</span>
					</div>
					<div class="control">
						<div class="select">
							<select bind:value={$recordingsUIState.filterStatus} on:change={loadRecordings}>
								<option value="ok">OK</option>
								<option value="not_ok">Ej OK</option>
								<option value="all">Alla</option>
							</select>
						</div>
					</div>
					<div class="control">
						<span class="button is-static">Typ:</span>
					</div>
					<div class="control">
						<div class="select">
							<select bind:value={$recordingsUIState.filterType} on:change={loadRecordings}>
								<option value="all">Alla typer</option>
								{#each recordingTypes as type}
									<option value={type.value}>{type.label}</option>
								{/each}
							</select>
						</div>
					</div>
					<div class="control">
						<span class="button is-static">{recordings.length} inspelningar</span>
					</div>
				</div>
			</div>
		</div>

		{#if loading}
			<div class="has-text-centered p-6">
				<div class="button is-loading is-large is-ghost"></div>
				<p class="mt-4">Laddar inspelningar...</p>
			</div>
		{:else if recordings.length === 0}
			<div class="notification is-info is-light">
				<p>Inga inspelningar hittades. Ladda upp några inspelningar för att komma igång!</p>
			</div>
		{:else}
			<div class="table-container">
				<table class="table is-fullwidth is-striped is-hoverable">
					<thead>
						<tr>
							<th>Status</th>
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
								<button class="button is-ghost" on:click={() => sortBy("author")}>
									Artist
									{#if getSortIcon("author")}
										<span class="icon is-small pl-2">
											<svelte:component this={getSortIcon("author")} size={14} />
										</span>
									{/if}
								</button>
							</th>
							<th>
								<button class="button is-ghost" on:click={() => sortBy("type")}>
									Typ
									{#if getSortIcon("type")}
										<span class="icon is-small pl-2">
											<svelte:component this={getSortIcon("type")} size={14} />
										</span>
									{/if}
								</button>
							</th>
							<th>
								<button class="button is-ghost" on:click={() => sortBy("duration")}>
									Längd
									{#if getSortIcon("duration")}
										<span class="icon is-small pl-2">
											<svelte:component this={getSortIcon("duration")} size={14} />
										</span>
									{/if}
								</button>
							</th>
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
										<span class="tag is-warning">Ej OK</span>
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
								<td>{recording.title || "Namnlös"}</td>
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
										{getSwedishRecordingType(recording.type)}
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
										<span>Redigera</span>
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
