<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { FileAudio, Check, AlertCircle, X } from "lucide-svelte";
	import { formatFileSize } from "@/api/fileUpload";
	import { getAllSwedishRecordingTypes } from "@/api/lang";
	import type { RecordingType } from "@/api/supabase/types";

	export let id: string;
	export let file: File;
	export let title: string;
	export let author: string;
	export let type: RecordingType;
	export let status: "pending" | "uploading" | "success" | "error";
	export let error: string | undefined = undefined;
	export let progress = 0;
	export let disabled = false;

	const dispatch = createEventDispatcher();
	const recordingTypes = getAllSwedishRecordingTypes();

	function getStatusIcon() {
		switch (status) {
			case "success":
				return Check;
			case "error":
				return AlertCircle;
			default:
				return FileAudio;
		}
	}

	function getStatusClass() {
		switch (status) {
			case "success":
				return "has-text-success";
			case "error":
				return "has-text-danger";
			case "uploading":
				return "has-text-info";
			default:
				return "";
		}
	}

	function handleRemove() {
		dispatch("remove", { id });
	}

	function handleUpdate(field: string, value: any) {
		dispatch("update", { id, field, value });
	}
</script>

<div class="upload-item box">
	<div class="level is-mobile">
		<div class="level-left">
			<div class="level-item">
				<span class="icon {getStatusClass()}">
					<svelte:component this={getStatusIcon()} size={20} />
				</span>
			</div>
			<div class="level-item">
				<div>
					<strong>{file.name}</strong>
					<br />
					<span class="tag is-small">{formatFileSize(file.size)}</span>
				</div>
			</div>
		</div>
		<div class="level-right">
			{#if status === "pending" && !disabled}
				<button
					class="delete is-small"
					aria-label="Remove"
					on:click={handleRemove}
				></button>
			{:else if status === "uploading"}
				<progress class="progress is-small is-info" value={progress} max="100">
					{progress}%
				</progress>
			{:else if status === "success"}
				<span class="tag is-success">Uppladdad</span>
			{:else if status === "error"}
				<span class="tag is-danger">Misslyckades</span>
			{/if}
		</div>
	</div>

	{#if error}
		<p class="help is-danger mt-2">{error}</p>
	{/if}

	{#if status === "pending"}
		<div class="columns is-mobile mt-2">
			<div class="column">
				<div class="field">
					<label class="label is-small" for="title-{id}">Titel</label>
					<div class="control">
						<input
							id="title-{id}"
							class="input is-small"
							type="text"
							bind:value={title}
							on:input={() => handleUpdate("title", title)}
							placeholder="Titel"
							{disabled}
						/>
					</div>
				</div>
			</div>
			<div class="column">
				<div class="field">
					<label class="label is-small" for="author-{id}">Artist</label>
					<div class="control">
						<input
							id="author-{id}"
							class="input is-small"
							type="text"
							bind:value={author}
							on:input={() => handleUpdate("author", author)}
							placeholder="Artist"
							{disabled}
						/>
					</div>
				</div>
			</div>
			<div class="column is-narrow">
				<div class="field">
					<label class="label is-small" for="type-{id}">Typ</label>
					<div class="control">
						<div class="select is-small">
							<select
								id="type-{id}"
								bind:value={type}
								on:change={() => handleUpdate("type", type)}
								{disabled}
							>
								{#each recordingTypes as recordingType}
									<option value={recordingType.value}>
										{recordingType.label}
									</option>
								{/each}
							</select>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.upload-item {
		margin-bottom: 1rem;
		position: relative;
	}

	.upload-item:last-child {
		margin-bottom: 0;
	}

	.progress {
		width: 100px;
	}
</style>
