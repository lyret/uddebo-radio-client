<script lang="ts">
	import Layout from "@/components/Layout.svelte";
	import Radio from "@/components/Radio.svelte";
	import AdminControls from "@/components/AdminControls.svelte";
	import { isAdmin } from "@/api";
	import {
		currentlyPlayingMedium,
		nextRecording,
		isPlaying,
		notifyTrackFinished,
	} from "@/api/broadcast";
	import { onMount, onDestroy } from "svelte";

	// Player state
	let audioElement: HTMLAudioElement;
	let instructions = "Tryck på strömknappen för att börja lyssna";
	let currentTrackId: string | null = null;
	let powerOn = false;

	// Handle track changes while playing
	$: if ($currentlyPlayingMedium && audioElement && $isPlaying) {
		const newTrackId = $currentlyPlayingMedium.recording.id;

		// Only update if the track has changed
		if (currentTrackId !== newTrackId) {
			currentTrackId = newTrackId;
			console.log("[Player] Track changed to:", $currentlyPlayingMedium.recording.title);

			// Update audio source
			audioElement.src = $currentlyPlayingMedium.recording.audioUrl;

			// Set loop for white noise
			audioElement.loop = $currentlyPlayingMedium.isWhiteNoise;

			// Set the current position
			if (!$currentlyPlayingMedium.isWhiteNoise) {
				audioElement.currentTime = $currentlyPlayingMedium.currentPosition;
			}

			// Start playing
			audioElement.play().catch((err) => {
				console.error("Failed to play audio:", err);
				instructions = "Kunde inte spela upp ljudet";
			});

			// Update instructions based on whether it's white noise
			if ($currentlyPlayingMedium.isWhiteNoise) {
				instructions = "Ingen sändning just nu";
			} else {
				instructions = "";
			}
		}
	}

	// Toggle play/pause
	function togglePlayback(power: boolean) {
		powerOn = power;
		$isPlaying = power;

		if (power) {
			if (audioElement && $currentlyPlayingMedium) {
				currentTrackId = $currentlyPlayingMedium.recording.id;
				console.log("[Player] Starting playback:", $currentlyPlayingMedium.recording.title);

				// Set source and position
				audioElement.src = $currentlyPlayingMedium.recording.audioUrl;

				// Set loop for white noise
				audioElement.loop = $currentlyPlayingMedium.isWhiteNoise;

				// Set start position
				if (!$currentlyPlayingMedium.isWhiteNoise) {
					audioElement.currentTime = $currentlyPlayingMedium.currentPosition;
				}

				// Start playing
				audioElement.play().catch((err) => {
					console.error("Failed to play audio:", err);
					instructions = "Kunde inte spela upp ljudet";
					$isPlaying = false;
					powerOn = false;
				});

				// Update instructions
				if ($currentlyPlayingMedium.isWhiteNoise) {
					instructions = "Inget program just nu - spelar vitt brus";
				} else {
					instructions = `Nu spelar: ${$currentlyPlayingMedium.recording.title}`;
				}
			}
		} else {
			instructions = "Tryck på strömknappen för att börja lyssna";
			currentTrackId = null;
			if (audioElement) {
				audioElement.pause();
			}
		}
	}

	// Handle when a track ends
	function handleTrackEnded() {
		console.log("[Player] Track ended");
		if ($currentlyPlayingMedium?.isWhiteNoise) {
			// White noise should loop automatically due to audioElement.loop = true
			console.log("[Player] White noise looping");
		} else {
			// For regular tracks, notify the broadcast system
			console.log("[Player] Notifying track finished");
			notifyTrackFinished();
		}
	}

	// Handle audio errors
	function handleAudioError(e: Event) {
		console.error("[Player] Audio error:", e);
		instructions = "Fel vid uppspelning";
	}

	// Setup audio element event listeners
	onMount(() => {
		if (audioElement) {
			audioElement.addEventListener("ended", handleTrackEnded);
			audioElement.addEventListener("error", handleAudioError);
		}
	});

	// Cleanup
	onDestroy(() => {
		// Make sure to update playing state on destroy
		$isPlaying = false;
		if (audioElement) {
			audioElement.removeEventListener("ended", handleTrackEnded);
			audioElement.removeEventListener("error", handleAudioError);
			audioElement.pause();
		}
	});
</script>

<Layout />

<!-- Hidden audio element -->
<audio bind:this={audioElement} />

<footer class="has-text-centered is-flex-align-items-flex-end mt-auto">
	<Radio
		bind:power={powerOn}
		on:power={(e) => togglePlayback(e.detail)}
		coverUrl={$currentlyPlayingMedium?.recording.coverUrl}
		display1={$currentlyPlayingMedium?.recording.title}
		display2={$currentlyPlayingMedium?.recording.author}
		display3={$nextRecording ? `Nästa: ${$nextRecording.title}` : ""}
	/>
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
