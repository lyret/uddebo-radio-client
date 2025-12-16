<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from "svelte";
	import { Play, Pause, Scissors } from "lucide-svelte";
	import { initializeWaveform, createTrimRegion, syncWaveformWithAudio } from "@/api/audioProcessing";
	import type WaveSurfer from "wavesurfer.js";
	import type RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
	import type { Region } from "wavesurfer.js/dist/plugins/regions.js";

	export let audioUrl: string;
	export let showTrimControls = false;
	export let enableTrimming = false;

	const dispatch = createEventDispatcher();

	let waveformContainer: HTMLElement;
	let audioElement: HTMLAudioElement;
	let wavesurfer: WaveSurfer | null = null;
	let regions: RegionsPlugin | null = null;
	let activeRegion: Region | null = null;
	let isPlaying = false;
	let trimStart = 0;
	let trimEnd = 0;

	$: if (audioElement && audioUrl) {
		audioElement.src = audioUrl;
	}

	onMount(async () => {
		if (!waveformContainer || !audioUrl) return;

		try {
			const result = await initializeWaveform({
				container: waveformContainer,
				url: audioUrl,
				height: 100,
				waveColor: "#3273dc",
				progressColor: "#00d1b2"
			});

			wavesurfer = result.wavesurfer;
			regions = result.regions;

			// Set up event listeners
			wavesurfer.on("play", () => {
				isPlaying = true;
				if (audioElement && audioElement.paused) {
					audioElement.play();
				}
			});

			wavesurfer.on("pause", () => {
				isPlaying = false;
				if (audioElement && !audioElement.paused) {
					audioElement.pause();
				}
			});

			wavesurfer.on("seeking", (progress: number) => {
				if (audioElement) {
					const time = progress * (audioElement.duration || 0);
					audioElement.currentTime = time;
				}
			});

			// Set up region events if trimming is enabled
			if (enableTrimming && regions) {
				regions.on("region-updated", (region: Region) => {
					activeRegion = region;
					trimStart = region.start;
					trimEnd = region.end;
				});
			}
		} catch (error) {
			console.error("Failed to initialize waveform:", error);
		}
	});

	onDestroy(() => {
		if (wavesurfer) {
			wavesurfer.destroy();
		}
	});

	function setupAudioListeners() {
		if (!audioElement) return;

		const handleTimeUpdate = () => {
			if (wavesurfer && audioElement) {
				syncWaveformWithAudio(wavesurfer, audioElement);
			}
		};

		const handlePlay = () => {
			isPlaying = true;
			if (wavesurfer) {
				const seekTo = audioElement.currentTime / (audioElement.duration || 1);
				wavesurfer.seekTo(seekTo);
				if (!wavesurfer.isPlaying()) {
					wavesurfer.play();
				}
			}
		};

		const handlePause = () => {
			isPlaying = false;
			if (wavesurfer && wavesurfer.isPlaying()) {
				wavesurfer.pause();
			}
		};

		audioElement.addEventListener("timeupdate", handleTimeUpdate);
		audioElement.addEventListener("play", handlePlay);
		audioElement.addEventListener("pause", handlePause);

		return () => {
			audioElement.removeEventListener("timeupdate", handleTimeUpdate);
			audioElement.removeEventListener("play", handlePlay);
			audioElement.removeEventListener("pause", handlePause);
		};
	}

	$: if (audioElement) {
		const cleanup = setupAudioListeners();
		onDestroy(cleanup);
	}

	function togglePlayPause() {
		if (isPlaying) {
			wavesurfer?.pause();
			audioElement?.pause();
		} else {
			wavesurfer?.play();
			audioElement?.play();
		}
	}

	function enableTrim() {
		if (!wavesurfer || !regions || !enableTrimming) return;

		showTrimControls = true;
		const duration = wavesurfer.getDuration();
		trimStart = 0;
		trimEnd = Math.min(duration, 30);

		activeRegion = createTrimRegion(regions, trimStart, trimEnd);
		dispatch("trimEnabled");
	}

	function applyTrim() {
		if (!activeRegion) return;

		dispatch("trim", {
			start: activeRegion.start,
			end: activeRegion.end
		});
	}

	function cancelTrim() {
		if (regions) {
			regions.clearRegions();
		}
		activeRegion = null;
		showTrimControls = false;
		dispatch("trimCancelled");
	}
</script>

<!-- Hidden audio element for synchronization -->
<audio bind:this={audioElement} style="display: none;" />

<div class="audio-player">
	<div bind:this={waveformContainer} class="waveform-container mb-3"></div>

	{#if wavesurfer}
		<div class="field">
			<div class="buttons">
				<button
					class="button is-primary"
					on:click={togglePlayPause}
					type="button"
				>
					{#if isPlaying}
						<span class="icon">
							<Pause size={20} />
						</span>
						<span>Pausa</span>
					{:else}
						<span class="icon">
							<Play size={20} />
						</span>
						<span>Spela</span>
					{/if}
				</button>

				{#if enableTrimming && !showTrimControls}
					<button
						class="button is-info is-outlined"
						on:click={enableTrim}
						type="button"
					>
						<span class="icon">
							<Scissors size={16} />
						</span>
						<span>Trimma</span>
					</button>
				{/if}
			</div>
		</div>

		{#if showTrimControls && activeRegion}
			<div class="notification is-info is-light mt-3">
				<p class="mb-2">
					<strong>Trimma ljudfil</strong>
				</p>
				<p class="mb-3">
					Dra i kanterna på det markerade området för att välja vilken del som ska behållas.
					Start: {trimStart.toFixed(1)}s - Slut: {trimEnd.toFixed(1)}s
				</p>
				<div class="buttons">
					<button
						class="button is-success is-small"
						on:click={applyTrim}
						type="button"
					>
						<span class="icon">
							<Scissors size={16} />
						</span>
						<span>Tillämpa trimning</span>
					</button>
					<button
						class="button is-small"
						on:click={cancelTrim}
						type="button"
					>
						Avbryt
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.waveform-container {
		width: 100%;
		min-height: 100px;
		border-radius: 4px;
		position: relative;
	}

	.waveform-container :global(wave) {
		overflow: visible !important;
	}

	.waveform-container :global(.wavesurfer-region) {
		border: 2px solid red;
		border-radius: 4px;
	}

	.waveform-container :global(::part(region-handle)) {
		border-color: #d4b013;
		width: 8px;
	}
</style>
