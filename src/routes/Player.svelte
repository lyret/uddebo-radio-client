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
	import { fly } from "svelte/transition";

	// Player state
	let audioElement: HTMLAudioElement;
	let instructions = "Tryck på strömknappen för att börja lyssna";
	let currentTrackId: string | null = null;
	let powerOn = false;

	// Footer element reference
	let footerElement: HTMLElement;

	/**
	 * Updates the Media Session API metadata for lock screen and notification controls
	 */
	function updateMediaSession() {
		if (!("mediaSession" in navigator)) {
			console.log("[Player] Media Session API not supported");
			return;
		}

		if ($currentlyPlayingMedium && !$currentlyPlayingMedium.isWhiteNoise) {
			// Set metadata for regular tracks
			navigator.mediaSession.metadata = new MediaMetadata({
				title: $currentlyPlayingMedium.recording.title || "Uddebo Radio",
				artist: $currentlyPlayingMedium.recording.author || "Live",
				album: "Uddebo Radio - LIVE", // Indicating this is live radio
				artwork: $currentlyPlayingMedium.recording.coverUrl
					? [
							{
								src: $currentlyPlayingMedium.recording.coverUrl,
								sizes: "512x512",
								type: "image/jpeg",
							},
							{
								src: $currentlyPlayingMedium.recording.coverUrl,
								sizes: "256x256",
								type: "image/jpeg",
							},
							{
								src: $currentlyPlayingMedium.recording.coverUrl,
								sizes: "128x128",
								type: "image/jpeg",
							},
							{
								src: $currentlyPlayingMedium.recording.coverUrl,
								sizes: "96x96",
								type: "image/jpeg",
							},
						]
					: [],
			});

			// Set playback state
			navigator.mediaSession.playbackState = $isPlaying ? "playing" : "paused";

			// For live streams, we can set position state to indicate it's live
			// by setting duration to Infinity or a very large number
			try {
				navigator.mediaSession.setPositionState({
					duration: Infinity, // This indicates a live stream
					playbackRate: 1,
					position: 0,
				});
			} catch {
				// Some browsers might not support Infinity, try a large number instead
				try {
					navigator.mediaSession.setPositionState({
						duration: 999999, // Very large duration to simulate live
						playbackRate: 1,
						position: 0,
					});
				} catch (e) {
					console.log("[Player] Could not set position state:", e);
				}
			}
		} else {
			// For white noise or no content
			navigator.mediaSession.metadata = new MediaMetadata({
				title: "Uddebo Radio",
				artist: "Ingen sändning",
				album: "LIVE",
			});
			navigator.mediaSession.playbackState = $isPlaying ? "playing" : "paused";
		}

		// Set up action handlers
		navigator.mediaSession.setActionHandler("play", () => {
			if (!powerOn) {
				togglePlayback(true);
			}
		});

		navigator.mediaSession.setActionHandler("pause", () => {
			if (powerOn) {
				togglePlayback(false);
			}
		});

		// For live streams, we might want to disable or customize seek behavior
		navigator.mediaSession.setActionHandler("seekbackward", null);
		navigator.mediaSession.setActionHandler("seekforward", null);
		navigator.mediaSession.setActionHandler("seekto", null);

		// Handle next/previous if you want to show upcoming tracks
		if ($nextRecording) {
			navigator.mediaSession.setActionHandler("nexttrack", null); // Disable for live
		}
		navigator.mediaSession.setActionHandler("previoustrack", null); // Disable for live
	}

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

			// Update media session
			updateMediaSession();
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
					instructions = "Ingen sändning just nu";
				} else {
					instructions = "";
				}

				// Update media session
				updateMediaSession();
			}
		} else {
			instructions = "Tryck på strömknappen för att börja lyssna";
			currentTrackId = null;
			if (audioElement) {
				audioElement.pause();
			}
			// Update media session to paused state
			if ("mediaSession" in navigator) {
				navigator.mediaSession.playbackState = "paused";
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

		// Scroll footer to bottom smoothly
		if (footerElement) {
			footerElement.scrollTo({
				top: footerElement.scrollHeight,
				behavior: "smooth",
			});
		}

		// Initialize media session if playing
		if ($isPlaying) {
			updateMediaSession();
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
		// Clear media session
		if ("mediaSession" in navigator) {
			navigator.mediaSession.metadata = null;
			navigator.mediaSession.playbackState = "none";
		}
	});
</script>

<Layout />

<!-- Hidden audio element -->
<audio bind:this={audioElement} />

<footer bind:this={footerElement} class="has-text-centered is-flex-align-items-flex-end mt-auto">
	<Radio
		bind:power={powerOn}
		on:power={(e) => togglePlayback(e.detail)}
		coverUrl={$currentlyPlayingMedium?.recording.coverUrl}
		display1={$currentlyPlayingMedium?.recording.title}
		display2={$currentlyPlayingMedium?.recording.author}
		display3={$nextRecording ? `Nästa: ${$nextRecording.title}` : ""}
	/>
	{#if instructions}
		<div class="instructions" transition:fly>
			{instructions}
		</div>
	{/if}

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
		max-height: 100vh;
		overflow-y: auto;
	}

	/* Instructions area */
	.instructions {
		margin-top: 2rem;
		margin-bottom: 2rem;
		text-align: center;
	}
</style>
