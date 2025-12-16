<script lang="ts">
	import { Download, CheckCircle, AlertCircle } from "lucide-svelte";
	import { formatFileSize } from "@/api/fileUpload";
	import { formatDuration } from "@/api/audioProcessing";
	import type { Recording } from "@/api/supabase/types";

	export let recording: Recording;
	export let coverUrl: string | null = null;

	function formatDateTime(dateString: string | null): string {
		if (!dateString) return "Ej angiven";
		return new Date(dateString).toLocaleString("sv-SE");
	}

	$: displayCoverUrl = coverUrl || recording.cover_url;
</script>

<div class="metadata-section">
	<div class="box">
		<h4 class="title is-6 mb-3">Information</h4>
		<div class="content is-small">
			<p>
				<strong>Storlek:</strong> {formatFileSize(recording.file_size)}
			</p>
			<p>
				<strong>Längd:</strong> {formatDuration(recording.duration)}
			</p>
			<p>
				<strong>Uppladdad:</strong> {formatDateTime(recording.uploaded_at)}
			</p>
			<p>
				<strong>Uppladdare:</strong> {recording.uploaded_by || "Anonym"}
			</p>
			{#if recording.edited_at && recording.edited_at !== recording.uploaded_at}
				<p>
					<strong>Senast ändrad:</strong> {formatDateTime(recording.edited_at)}
				</p>
			{/if}
			{#if recording.okey_at}
				<p>
					<strong>Godkänd:</strong> {formatDateTime(recording.okey_at)}
				</p>
			{/if}
		</div>

		{#if displayCoverUrl}
			<div class="field mt-3">
				<p class="label is-size-7">Omslagsbild</p>
				<figure class="image is-square">
					<img src={displayCoverUrl} alt="Recording cover" />
				</figure>
			</div>
		{/if}

		<div class="field mt-3">
			<a
				href={recording.file_url}
				download
				class="button is-small is-fullwidth is-outlined"
			>
				<span class="icon">
					<Download />
				</span>
				<span>Ladda ner ljudfil</span>
			</a>
		</div>
	</div>

	<div class="box" class:has-background-success-light={recording.okey_at !== null} class:has-background-warning-light={recording.okey_at === null}>
		<h4 class="title is-6 mb-3" class:has-text-success={recording.okey_at !== null} class:has-text-warning={recording.okey_at === null}>
			{#if recording.okey_at === null}
				<span class="icon">
					<AlertCircle />
				</span>
				<br />
				<span class="has-text-weight-semibold">
					Väntar på godkännande
				</span>
			{:else}
				<span class="icon">
					<CheckCircle />
				</span>
				<br />
				<span class="has-text-weight-semibold">Godkänd</span>
			{/if}
		</h4>
		<div class="field">
			<slot name="status-actions" />
		</div>
	</div>
</div>

<style>
	.content.is-small p {
		margin-bottom: 0.5em;
	}

	.image.is-square {
		width: 100%;
		max-width: 200px;
		margin: 0 auto;
	}
</style>
