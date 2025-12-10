<script lang="ts">
	import { onMount } from "svelte";
	import { push } from "svelte-spa-router";
	import { Edit2, Save, X, ChevronUp, ChevronDown, FileAudio, Play, Pause } from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import type { Recording, RecordingType, RecordingUpdate } from "@/api";
	import Layout from "@/components/Layout.svelte";
	import { supabase, isAdmin } from "@/api";

	let recordings: Recording[] = [];
	let loading = true;
	let editingId: string | null = null;
	let editForm: Partial<Recording> = {};
	let sortField: keyof Recording = "uploaded_at";
	let sortOrder: "asc" | "desc" = "desc";
	let playingId: string | null = null;
	let audioElement: HTMLAudioElement;

	// Recording types for dropdown
	const recordingTypes: RecordingType[] = [
		"unknown",
		"rejected",
		"music",
		"news",
		"commentary",
		"talk",
		"comedy",
		"talkshow",
		"interview",
		"jingle",
		"other",
	];

	onMount(() => {
		loadRecordings();
	});

	async function loadRecordings() {
		try {
			const { data, error } = await supabase
				.from("recordings")
				.select("*")
				.order(sortField, { ascending: sortOrder === "asc" });

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

	function startEdit(recording: Recording) {
		editingId = recording.id;
		editForm = { ...recording };
	}

	function cancelEdit() {
		editingId = null;
		editForm = {};
	}

	async function saveEdit() {
		if (!editingId || !editForm) return;

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			const updateData: RecordingUpdate = {
				title: editForm.title,
				author: editForm.author,
				description: editForm.description,
				link_out_url: editForm.link_out_url,
				type: editForm.type,
				edited_at: new Date().toISOString(),
				edited_by: user?.id || null,
			};

			const { error } = await supabase.from("recordings").update(updateData).eq("id", editingId);

			if (error) throw error;

			toast.success("Recording updated successfully");
			cancelEdit();
			loadRecordings();
		} catch (error) {
			toast.error("Failed to update recording");
			console.error(error);
		}
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
					<p class="has-text-grey">Total: {recordings.length} recordings</p>
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
									{#if editingId === recording.id}
										<td>
											<input
												class="input is-small"
												type="text"
												bind:value={editForm.title}
												placeholder="Title"
											/>
										</td>
										<td>
											<input
												class="input is-small"
												type="text"
												bind:value={editForm.author}
												placeholder="Author"
											/>
										</td>
										<td>
											<div class="select is-small">
												<select bind:value={editForm.type}>
													{#each recordingTypes as type}
														<option value={type}>{type}</option>
													{/each}
												</select>
											</div>
										</td>
										<td>{formatDuration(recording.duration)}</td>
										<td>{formatFileSize(recording.file_size)}</td>
										<td>
											<small>{formatDateTime(recording.uploaded_at)}</small>
										</td>
										<td>
											<input
												class="input is-small"
												type="text"
												bind:value={editForm.description}
												placeholder="Description"
											/>
										</td>
										<td></td>
										<td>
											<input
												class="input is-small"
												type="url"
												bind:value={editForm.link_out_url}
												placeholder="External URL"
											/>
										</td>
										<td>
											<div class="buttons are-small">
												<button class="button is-success is-small" on:click={saveEdit}>
													<span class="icon">
														<Save size={16} />
													</span>
												</button>
												<button class="button is-light is-small" on:click={cancelEdit}>
													<span class="icon">
														<X size={16} />
													</span>
												</button>
											</div>
										</td>
									{:else}
										<td>{recording.title || "Untitled"}</td>
										<td>{recording.author || "-"}</td>
										<td>
											<span
												class="tag is-small"
												class:is-danger={recording.type === "rejected"}
												class:is-info={recording.type === "music"}
												class:is-success={recording.type === "news"}
												class:is-warning={recording.type === "talk" ||
													recording.type === "talkshow" ||
													recording.type === "interview"}
												class:is-primary={recording.type === "commentary"}
												class:is-link={recording.type === "comedy"}
												class:is-light={recording.type === "unknown" || recording.type === "other"}
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
													class="button is-info is-small"
													on:click={() => startEdit(recording)}
												>
													<span class="icon">
														<Edit2 size={16} />
													</span>
												</button>
												<button
													class="button is-danger is-small"
													on:click={() => deleteRecording(recording.id)}
												>
													Delete
												</button>
											</div>
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<!-- Hidden audio element for playback -->
		<audio bind:this={audioElement} on:ended={handleAudioEnded} />
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

	.input.is-small,
	.select.is-small select {
		height: 2rem;
		font-size: 0.875rem;
	}

	.buttons {
		margin-bottom: 0;
	}
</style>
