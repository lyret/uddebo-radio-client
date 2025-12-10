<script lang="ts">
	import { push } from "svelte-spa-router";
	import { onMount } from "svelte";
	import { Calendar, Plus, Edit2, Trash2, Radio } from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import type { BroadcastProgram, Recording } from "@/api";
	import Layout from "@/components/Layout.svelte";
	import { supabase, isAdmin } from "@/api";

	let programs: BroadcastProgram[] = [];
	let recordings: Recording[] = [];
	let loading = true;
	let showCreateForm = false;
	let editingProgram: BroadcastProgram | null = null;

	// Form fields
	let title = "";
	let description = "";
	let startTime = "";
	let isActive = true;
	let selectedRecordings: string[] = [];

	onMount(() => {
		loadPrograms();
		loadRecordings();
	});

	async function loadPrograms() {
		try {
			const { data, error } = await supabase
				.from("broadcast_programs")
				.select("*")
				.order("start_time", { ascending: true });

			if (error) throw error;
			programs = data || [];
		} catch (error) {
			toast.error("Failed to load broadcast programs");
			console.error(error);
		} finally {
			loading = false;
		}
	}

	async function loadRecordings() {
		try {
			const { data, error } = await supabase
				.from("recordings")
				.select("*")
				.not("type", "eq", "rejected")
				.order("uploaded_at", { ascending: false });

			if (error) throw error;
			recordings = data || [];
		} catch (error) {
			toast.error("Failed to load recordings");
			console.error(error);
		}
	}

	async function handleSubmit() {
		if (!title.trim() || !startTime) {
			toast.error("Please fill in all required fields");
			return;
		}

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			const programData = {
				title: title.trim(),
				description: description.trim() || null,
				start_time: new Date(startTime).toISOString(),
				is_active: isActive,
				recordings: selectedRecordings,
				...(editingProgram
					? {
							edited_at: new Date().toISOString(),
							edited_by: user?.id || null,
						}
					: {
							created_at: new Date().toISOString(),
							created_by: user?.id || null,
							edited_at: new Date().toISOString(),
							edited_by: user?.id || null,
						}),
			};

			if (editingProgram) {
				const { error } = await supabase
					.from("broadcast_programs")
					.update(programData)
					.eq("id", editingProgram.id);

				if (error) throw error;
				toast.success("Broadcast program updated successfully");
			} else {
				const { error } = await supabase.from("broadcast_programs").insert(programData);

				if (error) throw error;
				toast.success("Broadcast program created successfully");
			}

			resetForm();
			loadPrograms();
		} catch (error) {
			toast.error(editingProgram ? "Failed to update program" : "Failed to create program");
			console.error(error);
		}
	}

	async function deleteProgram(id: string) {
		if (!confirm("Are you sure you want to delete this broadcast program?")) return;

		try {
			const { error } = await supabase.from("broadcast_programs").delete().eq("id", id);

			if (error) throw error;
			toast.success("Broadcast program deleted");
			loadPrograms();
		} catch (error) {
			toast.error("Failed to delete program");
			console.error(error);
		}
	}

	function editProgram(program: BroadcastProgram) {
		editingProgram = program;
		title = program.title;
		description = program.description || "";
		startTime = new Date(program.start_time).toISOString().slice(0, 16);
		isActive = program.is_active;
		selectedRecordings = [...program.recordings];
		showCreateForm = true;
	}

	function resetForm() {
		title = "";
		description = "";
		startTime = "";
		isActive = true;
		selectedRecordings = [];
		showCreateForm = false;
		editingProgram = null;
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

	function formatDateTime(dateString: string) {
		return new Date(dateString).toLocaleString();
	}

	function getRecordingTitle(recordingId: string) {
		const recording = recordings.find((r) => r.id === recordingId);
		return recording?.title || "Untitled Recording";
	}

	// Redirect to home if not admin
	$: if (!$isAdmin) {
		push("/");
	}
</script>

{#if $isAdmin}
	<Layout fullWidth={true}>
		<div class="broadcast-programs">
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
					<button
						class="button is-primary"
						on:click={() => (showCreateForm = !showCreateForm)}
						disabled={showCreateForm}
					>
						<span class="icon">
							<Plus size={16} />
						</span>
						<span>Create Program</span>
					</button>
				</div>
			</div>

			{#if showCreateForm}
				<div class="box mb-5">
					<h3 class="title is-5">{editingProgram ? "Edit" : "Create"} Broadcast Program</h3>
					<form on:submit|preventDefault={handleSubmit}>
						<div class="field">
							<label class="label" for="program-title">Title *</label>
							<div class="control">
								<input
									id="program-title"
									class="input"
									type="text"
									bind:value={title}
									placeholder="Enter program title"
									required
								/>
							</div>
						</div>

						<div class="field">
							<label class="label" for="program-description">Description</label>
							<div class="control">
								<textarea
									id="program-description"
									class="textarea"
									bind:value={description}
									placeholder="Enter program description"
									rows="3"
								/>
							</div>
						</div>

						<div class="field">
							<label class="label" for="program-start-time">Start Time *</label>
							<div class="control">
								<input
									id="program-start-time"
									class="input"
									type="datetime-local"
									bind:value={startTime}
									required
								/>
							</div>
						</div>

						<div class="field">
							<label class="checkbox">
								<input type="checkbox" bind:checked={isActive} />
								Active (will be played at scheduled time)
							</label>
						</div>

						<div class="field">
							<p class="label">Recordings</p>
							<p class="help mb-3">Select recordings and arrange them in order (optional)</p>

							{#if selectedRecordings.length > 0}
								<div class="box">
									<h4 class="subtitle is-6 mb-3">Selected Recordings (in order):</h4>
									{#each selectedRecordings as recordingId, index}
										<div class="level is-mobile">
											<div class="level-left">
												<span>{index + 1}. {getRecordingTitle(recordingId)}</span>
											</div>
											<div class="level-right">
												<div class="buttons has-addons">
													<button
														type="button"
														class="button is-small"
														on:click={() => moveRecording(index, "up")}
														disabled={index === 0}
													>
														↑
													</button>
													<button
														type="button"
														class="button is-small"
														on:click={() => moveRecording(index, "down")}
														disabled={index === selectedRecordings.length - 1}
													>
														↓
													</button>
													<button
														type="button"
														class="button is-small is-danger"
														on:click={() => toggleRecording(recordingId)}
													>
														Remove
													</button>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}

							{#if recordings.length === 0}
								<div class="notification is-warning is-light">
									<p>
										No recordings available. Upload some recordings first to add them to programs.
									</p>
								</div>
							{:else}
								<div class="recording-selection">
									{#each recordings as recording}
										{#if !selectedRecordings.includes(recording.id)}
											<label class="checkbox is-block mb-2">
												<input type="checkbox" on:change={() => toggleRecording(recording.id)} />
												{recording.title || "Untitled"}
												{#if recording.author}
													<span class="has-text-grey"> - {recording.author}</span>
												{/if}
											</label>
										{/if}
									{/each}
								</div>
							{/if}
						</div>

						<div class="field is-grouped">
							<div class="control">
								<button type="submit" class="button is-primary">
									{editingProgram ? "Update" : "Create"} Program
								</button>
							</div>
							<div class="control">
								<button type="button" class="button is-light" on:click={resetForm}> Cancel </button>
							</div>
						</div>
					</form>
				</div>
			{/if}

			{#if loading}
				<div class="has-text-centered">
					<span class="icon is-large">
						<Radio size={48} />
					</span>
					<p>Loading programs...</p>
				</div>
			{:else if programs.length === 0}
				<div class="notification is-info is-light">
					<p>No broadcast programs yet. Create one to get started!</p>
				</div>
			{:else}
				<div class="programs-list">
					{#each programs as program}
						<div class="box mb-3">
							<div class="level is-mobile">
								<div class="level-left">
									<div>
										<h3 class="title is-5 mb-2">{program.title}</h3>
										{#if program.description}
											<p class="mb-2">{program.description}</p>
										{/if}
										<div class="tags">
											<span
												class="tag"
												class:is-success={program.is_active}
												class:is-warning={!program.is_active}
											>
												{program.is_active ? "Active" : "Inactive"}
											</span>
											<span class="tag">
												<span class="icon is-small">
													<Calendar size={14} />
												</span>
												<span>{formatDateTime(program.start_time)}</span>
											</span>
											<span class="tag">
												<span class="icon is-small">
													<Radio size={14} />
												</span>
												<span
													>{program.recordings.length === 0
														? "No recordings yet"
														: `${program.recordings.length} recording${program.recordings.length === 1 ? "" : "s"}`}</span
												>
											</span>
										</div>
									</div>
								</div>
								<div class="level-right">
									<div class="buttons">
										<button class="button is-small is-info" on:click={() => editProgram(program)}>
											<span class="icon">
												<Edit2 size={16} />
											</span>
										</button>
										<button
											class="button is-small is-danger"
											on:click={() => deleteProgram(program.id)}
										>
											<span class="icon">
												<Trash2 size={16} />
											</span>
										</button>
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</Layout>
{/if}

<style>
	.recording-selection {
		max-height: 300px;
		overflow-y: auto;
		padding: 1rem;
		border: 1px solid #dbdbdb;
		border-radius: 4px;
	}
</style>
