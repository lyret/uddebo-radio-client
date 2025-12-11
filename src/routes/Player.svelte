<script lang="ts">
	import Layout from "@/components/Layout.svelte";
	import Radio from "@/components/Radio.svelte";
	import AdminControls from "@/components/AdminControls.svelte";
	import { isAdmin } from "@/api";
	import { currentlyPlayingMedium } from "@/api/broadcast";

	// Player state
	let isPlaying = false;
	let audioElement: HTMLAudioElement;
	let instructions = "Tryck på strömknappen för att börja lyssna";

	// Subscribe to currentlyPlayingMedium
	$: if ($currentlyPlayingMedium && audioElement && isPlaying) {
		// Update audio source and play
		audioElement.src = $currentlyPlayingMedium.audioUrl;
		audioElement.play().catch((err) => {
			console.error("Failed to play audio:", err);
			instructions = "Kunde inte spela upp ljudet";
		});
	}

	// Toggle play/pause
	function togglePlayback(power: boolean) {
		isPlaying = power;
		if (isPlaying) {
			instructions = "Nu spelar från Uddebo Radio";
			if (audioElement && $currentlyPlayingMedium) {
				audioElement.src = $currentlyPlayingMedium.audioUrl;
				audioElement.play().catch((err) => {
					console.error("Failed to play audio:", err);
					instructions = "Kunde inte spela upp ljudet";
				});
			}
		} else {
			instructions = "Tryck på strömknappen för att börja lyssna";
			if (audioElement) {
				audioElement.pause();
			}
		}
	}
</script>

<Layout />

<!-- Hidden audio element -->
<audio bind:this={audioElement} />

<footer class="has-text-centered is-flex-align-items-flex-end mt-auto">
	<Radio bind:power={isPlaying} on:power={(e) => togglePlayback(e.detail)} />
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
		z-index: -100;
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
