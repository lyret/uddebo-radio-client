<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import type { RecordingType } from "@/api/supabase/types";
	import { getAllSwedishRecordingTypes } from "@/api/lang";

	export let title = "";
	export let author = "";
	export let description = "";
	export let type: RecordingType = "unknown";
	export let linkOutUrl = "";
	export let disabled = false;

	const dispatch = createEventDispatcher();
	const recordingTypes = getAllSwedishRecordingTypes();

	function handleSubmit() {
		dispatch("save", {
			title,
			author,
			description,
			type,
			link_out_url: linkOutUrl
		});
	}

	function handleChange() {
		dispatch("change", {
			title,
			author,
			description,
			type,
			link_out_url: linkOutUrl
		});
	}
</script>

<form on:submit|preventDefault={handleSubmit}>
	<div class="field">
		<label class="label" for="modal-title">Titel *</label>
		<div class="control">
			<input
				id="modal-title"
				class="input"
				type="text"
				bind:value={title}
				on:input={handleChange}
				placeholder="Titel på inspelningen"
				required
				{disabled}
			/>
		</div>
	</div>

	<div class="field">
		<label class="label" for="modal-author">Artist/Upphovsperson</label>
		<div class="control">
			<input
				id="modal-author"
				class="input"
				type="text"
				bind:value={author}
				on:input={handleChange}
				placeholder="Artist, band eller upphovsperson"
				{disabled}
			/>
		</div>
	</div>

	<div class="field">
		<label class="label" for="modal-description">Beskrivning</label>
		<div class="control">
			<textarea
				id="modal-description"
				class="textarea"
				bind:value={description}
				on:input={handleChange}
				placeholder="Beskrivning av inspelningen"
				rows="3"
				{disabled}
			></textarea>
		</div>
	</div>

	<div class="field">
		<label class="label" for="modal-type">Typ av inspelning</label>
		<div class="control">
			<div class="select is-fullwidth">
				<select
					id="modal-type"
					bind:value={type}
					on:change={handleChange}
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

	<div class="field">
		<label class="label" for="modal-link">Extern länk</label>
		<div class="control">
			<input
				id="modal-link"
				class="input"
				type="url"
				bind:value={linkOutUrl}
				on:input={handleChange}
				placeholder="https://..."
				{disabled}
			/>
		</div>
		<p class="help">Länk till artist, Spotify, YouTube eller annan relevant sida</p>
	</div>
</form>
