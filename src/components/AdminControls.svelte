<script lang="ts">
	import { dateTimeStore, effectiveDateTime, timeOffsetMinutes } from "@/api";

	/**
	 * Debug controls for manipulating the effective datetime used by the player.
	 * Allows admins to test scheduled content by setting a specific date/time.
	 */
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
			<p class="help">
				Radiospelaren utgår från tidpunken {$effectiveDateTime.toLocaleString("sv-SE")}. Använd
				dessa kontroller för att testa kommande sändningar.
			</p>
		</div>
	</div>
</div>

<style>
	.help {
		text-align: left;
	}
</style>
