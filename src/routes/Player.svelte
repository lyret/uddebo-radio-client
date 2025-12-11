<script lang="ts">
	import Layout from "@/components/Layout.svelte";
	import Radio from "@/components/Radio.svelte";
	import AdminControls from "@/components/AdminControls.svelte";
	import { isAdmin } from "@/api";

	// Player state
	let isPlaying = false;
	let currentTrack = {
		title: "Ingen låt spelas",
		artist: "—",
		coverUrl: "",
	};
	let instructions = "Tryck på strömknappen för att börja lyssna";

	// Toggle play/pause
	function togglePlayback() {
		isPlaying = !isPlaying;
		if (isPlaying) {
			instructions = "Nu spelar från Uddebo Radio";
			// TODO: Start actual playback
			// Use $effectiveDateTime to determine what content to play
			// based on the schedule for that specific date/time
		} else {
			instructions = "Tryck på strömknappen för att börja lyssna";
			// TODO: Stop actual playback
		}
	}
</script>

<Layout />
<footer class="has-text-centered is-flex-align-items-flex-end mt-auto">
	<Radio bind:isPlaying {currentTrack} on:click={togglePlayback} />
	<div class="instructions">
		{instructions}
	</div>

	<!-- Debug area for admins -->
	{#if $isAdmin}
		<AdminControls />
	{/if}
</footer>

<style>
	footer {
		position: fixed;
		left: 0;
		bottom: 0;
		width: 100%;
	}

	/* Instructions area */
	.instructions {
		margin-top: 2rem;
		margin-bottom: 2rem;
		text-align: center;
	}
</style>
