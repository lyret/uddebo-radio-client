<script lang="ts">
	import {
		dateTimeStore,
		effectiveDateTime,
		broadcastScheduleStore,
		currentRecording,
		nextRecording,
	} from "@/api";

	/**
	 * Debug controls for manipulating the effective datetime used by the player.
	 * Allows admins to test scheduled content by setting a specific date/time.
	 */

	/**
	 * Format duration from seconds to MM:SS
	 */
	function formatDuration(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${minutes}:${secs.toString().padStart(2, "0")}`;
	}

	/**
	 * Format time to HH:MM
	 */
	function formatTime(date: Date): string {
		return date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
	}

	/**
	 * Format date and time to readable format
	 */
	function formatDateTime(date: Date): string {
		return date.toLocaleString("sv-SE", {
			day: "numeric",
			month: "long",
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	/**
	 * Calculate total program duration
	 */
	function calculateTotalDuration(): string {
		if (!$broadcastScheduleStore.startTime || !$broadcastScheduleStore.endTime) {
			return "";
		}
		const totalSeconds =
			($broadcastScheduleStore.endTime.getTime() - $broadcastScheduleStore.startTime.getTime()) /
			1000;
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		if (hours > 0) {
			return `${hours}h ${minutes}min`;
		}
		return `${minutes}min`;
	}

	/**
	 * Set the effective datetime to a specific date
	 */
	function setDateTimeToDate(date: Date | null): void {
		if (!date) {
			return;
		}
		// Convert to local datetime-local format (YYYY-MM-DDTHH:MM:SS)
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");
		const seconds = String(date.getSeconds()).padStart(2, "0");
		const localDateTimeString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
		dateTimeStore.setDateTime(localDateTimeString);
	}
</script>

<div class="notification is-link is-light">
	<div class="columns">
		<div class="column">
			<div class="field has-addons">
				<div class="control">
					<input
						class="input"
						type="datetime-local"
						value={$dateTimeStore.debugDateTimeInput}
						on:input={(e) => dateTimeStore.updateDebugInput(e.currentTarget.value)}
						on:change={(e) => dateTimeStore.setDateTime(e.currentTarget.value)}
					/>
				</div>
				<div class="control">
					<button
						class="button is-link"
						on:click={() => dateTimeStore.setDateTime($dateTimeStore.debugDateTimeInput)}
					>
						Ställ in datum/tid
					</button>
				</div>
				<div class="control">
					<button
						class="button"
						disabled={$dateTimeStore.timeOffset === 0}
						on:click={() => dateTimeStore.useCurrentTime()}
					>
						Använd aktuell tid
					</button>
				</div>
			</div>
			<p class="help">
				Radiospelaren utgår från tidpunken {$effectiveDateTime.toLocaleString("sv-SE")}. Använd
				dessa kontroller för att testa kommande sändningar.
			</p>
		</div>
		<div class="column">
			{#if $broadcastScheduleStore.loading}
				<p class="help">Laddar sändningsinformation...</p>
			{:else if $broadcastScheduleStore.error}
				<p class="help has-text-danger">Fel: {$broadcastScheduleStore.error}</p>
			{:else if $broadcastScheduleStore.program}
				<div class="broadcast-info">
					<p class="has-text-weight-semibold has-text-left">
						{$broadcastScheduleStore.program.title}
					</p>
					{#if $broadcastScheduleStore.startTime && $broadcastScheduleStore.endTime}
						<p class="help">
							Sändningstid: <button
								class="datetime-link"
								on:click={() => setDateTimeToDate($broadcastScheduleStore.startTime)}
								type="button"
							>
								{formatDateTime($broadcastScheduleStore.startTime)}
							</button>
							-
							<button
								class="datetime-link"
								on:click={() => setDateTimeToDate($broadcastScheduleStore.endTime)}
								type="button"
							>
								{formatTime($broadcastScheduleStore.endTime)}
							</button>
							({calculateTotalDuration()})
						</p>
					{/if}

					{#if $currentRecording}
						<div class="current-recording">
							<p class="help has-text-weight-medium">Nu spelas:</p>
							<p class="help">
								{$currentRecording.title}
								{#if $currentRecording.author}
									<span class="has-text-grey">- {$currentRecording.author}</span>
								{/if}
							</p>
							<p class="help has-text-grey">
								<button
									class="datetime-link"
									on:click={() => setDateTimeToDate($currentRecording.startTime)}
									type="button"
								>
									{formatTime($currentRecording.startTime)}
								</button>
								-
								<button
									class="datetime-link"
									on:click={() => setDateTimeToDate($currentRecording.endTime)}
									type="button"
								>
									{formatTime($currentRecording.endTime)}
								</button>
								({formatDuration($currentRecording.duration)})
							</p>
						</div>
					{/if}

					{#if $nextRecording}
						<div class="next-recording">
							<p class="help has-text-weight-medium">Nästa:</p>
							<p class="help">
								{$nextRecording.title}
								{#if $nextRecording.author}
									<span class="has-text-grey">- {$nextRecording.author}</span>
								{/if}
							</p>
							<p class="help has-text-grey">
								<button
									class="datetime-link"
									on:click={() => setDateTimeToDate($nextRecording.startTime)}
									type="button"
								>
									{formatTime($nextRecording.startTime)}
								</button>
								({formatDuration($nextRecording.duration)})
							</p>
						</div>
					{/if}

					{#if $broadcastScheduleStore.recordings.length > 0}
						<p class="help has-text-grey-light">
							Totalt {$broadcastScheduleStore.recordings.length} inspelningar i programmet
						</p>
					{/if}
				</div>
			{:else}
				<p class="help">Inget aktivt sändningsprogram hittades.</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.help {
		text-align: left;
	}

	.broadcast-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.current-recording,
	.next-recording {
		margin-top: 0.5rem;
	}

	.current-recording {
		padding: 0.5rem;
		background-color: rgba(0, 0, 0, 0.05);
		border-radius: 4px;
	}

	.datetime-link {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: #3273dc;
		text-decoration: underline;
		cursor: pointer;
		display: inline;
	}

	.datetime-link:hover {
		color: #2366d1;
		text-decoration: underline;
	}

	.datetime-link:active {
		color: #1e5bb8;
	}
</style>
