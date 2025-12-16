<script lang="ts">
	import Layout from "@/components/Layout.svelte";
	import Radio from "@/components/Radio.svelte";
	import AdminControls from "@/components/AdminControls.svelte";
	import SnowEffect from "@/components/SnowEffect.svelte";
	import { isAdmin, isAuthenticated } from "@/api";
	import {
		currentlyPlayingMedium,
		nextRecording,
		isPlaying,
		notifyTrackFinished,
		broadcastScheduleStore,
	} from "@/api/broadcast";
	import { effectiveDateTime } from "@/api/datetime";
	import { onMount, onDestroy } from "svelte";
	import { fade } from "svelte/transition";
	import {
		storeOriginalTitle,
		updateDocumentTitle,
		restoreDocumentTitle,
	} from "@/api/documentTitle";

	// Player state
	let audioElement: HTMLAudioElement;
	let instructions = "Tryck på strömknappen för att börja lyssna";
	let currentTrackId: string | null = null;
	let powerOn = false;

	// Footer element reference
	let footerElement: HTMLElement;

	// Display text for the radio
	let display1Text = "";
	let display2Text = "";
	let display3Text = "";

	// Check if it's winter months (December, January, February)
	const isWinter = (() => {
		const month = new Date().getMonth();
		return month === 11 || month === 0 || month === 1; // 11=Dec, 0=Jan, 1=Feb
	})();

	// Show snow effect if winter and not signed in
	$: showSnow = isWinter && !$isAuthenticated;

	/**
	 * Formats time duration into a readable string
	 */
	function formatTimeUntil(milliseconds: number): string {
		const seconds = Math.floor(milliseconds / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return `Börjar om ${days} dag${days > 1 ? "ar" : ""}`;
		} else if (hours > 0) {
			const remainingMinutes = minutes % 60;
			if (remainingMinutes > 0) {
				return `Om ${hours} tim ${remainingMinutes} min`;
			}
			return `Börjar om ${hours} timm${hours > 1 ? "ar" : "e"}`;
		} else if (minutes > 0) {
			return `Börjar om ${minutes} minut${minutes > 1 ? "er" : ""}`;
		} else if (seconds > 0) {
			return `Börjar om ${seconds} sekund${seconds > 1 ? "er" : ""}`;
		}
		return "";
	}

	/**
	 * Updates the browser document title based on playback state
	 */
	function updateBrowserTitle() {
		if ($isPlaying && $currentlyPlayingMedium) {
			if ($currentlyPlayingMedium.isWhiteNoise) {
				updateDocumentTitle("▶ Ingen sändning - Uddebo Radio");
			} else {
				const title = $currentlyPlayingMedium.recording.title || "";
				const track = $currentlyPlayingMedium.recording.author
					? title + " (" + $currentlyPlayingMedium.recording.author + ")"
					: title;
				updateDocumentTitle(`▶ ${track} | Uddebo Radio`);
			}
		} else {
			restoreDocumentTitle();
		}
	}

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
				artist: $currentlyPlayingMedium.recording.author || "",
				album: "Uddebo Radio LIVE",
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
		} else {
			// For white noise or no content - don't show position
			navigator.mediaSession.metadata = new MediaMetadata({
				title: "Ingen sändning",
				artist: "",
				album: "Uddebo Radio LIVE",
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

	// Reactive statement to update browser title when track or playing state changes
	$: {
		if ($isPlaying && $currentlyPlayingMedium) {
			updateBrowserTitle();
		} else if (!$isPlaying) {
			updateBrowserTitle();
		}
	}

	// Reactive statement to update display texts
	$: {
		if ($currentlyPlayingMedium) {
			if ($currentlyPlayingMedium.isWhiteNoise) {
				// When white noise is playing
				display1Text = "Ingen sändning";
				display2Text = "";

				// Calculate time until next broadcast
				if ($nextRecording && $effectiveDateTime) {
					const timeUntilNext = $nextRecording.startTime.getTime() - $effectiveDateTime.getTime();
					display2Text = $broadcastScheduleStore?.program?.title || "";
					if (timeUntilNext > 0) {
						display3Text = formatTimeUntil(timeUntilNext);
					} else {
						display3Text = "";
					}
				} else if (
					$broadcastScheduleStore?.recordings?.length > 0 &&
					$broadcastScheduleStore.startTime &&
					$effectiveDateTime
				) {
					// Check if the broadcast hasn't started yet
					const timeUntilStart =
						$broadcastScheduleStore.startTime.getTime() - $effectiveDateTime.getTime();
					if (timeUntilStart > 0) {
						display3Text = formatTimeUntil(timeUntilStart);
					} else {
						display3Text = "";
					}
				} else {
					display3Text = "";
				}
			} else {
				// When a real recording is playing
				display1Text = $currentlyPlayingMedium.recording.title || "";
				display2Text = $currentlyPlayingMedium.recording.author || "";

				// Check for external link
				if ($currentlyPlayingMedium.recording.linkOutUrl) {
					display3Text = $currentlyPlayingMedium.recording.linkOutUrl;
				} else {
					display3Text = "";
				}
			}
		} else {
			// No medium playing
			display1Text = "";
			display2Text = "";
			display3Text = "";
		}
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

			// Update media session and browser title
			updateMediaSession();
			updateBrowserTitle();
		}
	}

	// Toggle play/pause
	function togglePlayback(power: boolean) {
		powerOn = power;
		$isPlaying = power;

		if (power) {
			instructions = "";
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

				// Update media session and browser title
				updateMediaSession();
				updateBrowserTitle();
			}
		} else {
			instructions = "";
			currentTrackId = null;
			if (audioElement) {
				audioElement.pause();
			}
			// Update media session to paused state
			if ("mediaSession" in navigator) {
				navigator.mediaSession.playbackState = "paused";
			}
			// Restore original browser title
			updateBrowserTitle();
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
		// Store the original document title
		storeOriginalTitle();

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

		// Initialize media session and browser title if playing
		if ($isPlaying) {
			updateMediaSession();
			updateBrowserTitle();
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
		// Restore original browser title
		restoreDocumentTitle();
	});
</script>

<!-- Winter background wrapper -->
{#if isWinter}
	<div class="winter-background"></div>
{/if}

<Layout />

<!-- Snow effect for winter when not signed in -->
{#if showSnow}
	<SnowEffect />
{/if}

<!-- Hidden audio element -->
<audio bind:this={audioElement} />

<footer bind:this={footerElement} class="has-text-centered is-flex-align-items-flex-end mt-auto">
	<Radio
		bind:power={powerOn}
		on:power={(e) => togglePlayback(e.detail)}
		coverUrl={$currentlyPlayingMedium?.recording.coverUrl}
		display1={display1Text}
		display2={display2Text}
		display3={display3Text}
		description={$currentlyPlayingMedium?.recording.description}
	/>
	{#if instructions}
		<div class="instructions" transition:fade>
			{instructions}
		</div>
	{/if}

	<!-- Debug area for admins -->
	{#if $isAdmin}
		<AdminControls />
	{/if}
</footer>

<style>
	/* Winter background */
	.winter-background {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(to bottom, #e0e0e0 0%, #ffffff 100%);
		z-index: -200;
	}

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

	@media (orientation: portrait) and (max-width: 700px) {
		.instructions {
			order: 1;
		}
	}
</style>
