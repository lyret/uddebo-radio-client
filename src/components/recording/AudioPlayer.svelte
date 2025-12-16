<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from "svelte";
	import { Play, Pause, Scissors, Upload, Volume2, AlertTriangle, X } from "lucide-svelte";
	import {
		initializeWaveform,
		createTrimRegion,
		syncWaveformWithAudio,
		analyzeAudioLevels,
		willClip,
		createNormalizationOptions,
		createNormalizedPreview,
		revokePreviewUrl,
	} from "@/api/audioProcessing";
	import type WaveSurfer from "wavesurfer.js";
	import type RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
	import type { Region } from "wavesurfer.js/dist/plugins/regions.js";

	export let audioUrl: string;
	export let showTrimControls = false;
	export let enableTrimming = false;
	export let enableReplacement = false;
	export let enableVolumeControl = false;

	const dispatch = createEventDispatcher();

	let waveformContainer: HTMLElement;
	let audioElement: HTMLAudioElement;
	let wavesurfer: WaveSurfer | null = null;
	let regions: RegionsPlugin | null = null;
	let activeRegion: Region | null = null;
	let isPlaying = false;
	let trimStart = 0;
	let trimEnd = 0;
	let showReplaceControls = false;
	let fileInput: HTMLInputElement;

	// Volume control state
	let showVolumeControls = false;
	let volumeAdjustment = 0; // in dB
	let previewAudioElement: HTMLAudioElement;
	let audioAnalysis: {
		peakDb: number;
		rmsDb: number;
		suggestedGainDb: number;
		clipsAtCurrentLevel: boolean;
		dynamicRange: number;
		needsCompression: boolean;
	} | null = null;
	let isAnalyzing = false;
	let clippingWarning = false;
	let useCompression = false;
	let useLeveling = false;
	let compressionStrength = "medium"; // light, medium, heavy
	let previewUrl: string | null = null;
	let previewBlob: Blob | null = null;
	let isProcessingPreview = false;
	let isPlayingPreview = false;

	$: if (audioElement && audioUrl) {
		audioElement.src = audioUrl;
	}

	// Update clipping warning
	$: if (audioAnalysis) {
		clippingWarning = willClip(audioAnalysis.peakDb, volumeAdjustment);
	}

	// Restart preview when settings change while playing
	let lastSettings = "";
	$: currentSettings = `${volumeAdjustment}-${useCompression}-${useLeveling}-${compressionStrength}`;

	$: if (isPlayingPreview && currentSettings !== lastSettings && lastSettings !== "") {
		// Settings changed while playing, restart preview
		restartPreview();
	}

	$: lastSettings = currentSettings;

	async function initWaveform() {
		if (!waveformContainer || !audioUrl) return;

		try {
			const result = await initializeWaveform({
				container: waveformContainer,
				url: audioUrl,
				height: 100,
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
	}

	onMount(async () => {
		await initWaveform();
	});

	// Exported method to stop audio playback
	export function stop() {
		if (audioElement) {
			audioElement.pause();
			audioElement.currentTime = 0;
		}
		if (wavesurfer && wavesurfer.isPlaying()) {
			wavesurfer.pause();
		}
		isPlaying = false;
	}

	onDestroy(() => {
		// Stop audio playback
		stop();

		// Clean up preview URL if exists
		if (previewUrl) {
			revokePreviewUrl(previewUrl);
		}

		// Destroy waveform
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
			end: activeRegion.end,
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

	function enableReplace() {
		showReplaceControls = true;
		showTrimControls = false;
		if (regions) {
			regions.clearRegions();
		}
		activeRegion = null;
		dispatch("replaceEnabled");
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file && file.type.startsWith("audio/")) {
			dispatch("replace", { file });
			showReplaceControls = false;
			if (fileInput) fileInput.value = "";
		}
	}

	function cancelReplace() {
		showReplaceControls = false;
		if (fileInput) fileInput.value = "";
		dispatch("replaceCancelled");
	}

	async function enableVolumeAdjust() {
		showVolumeControls = true;
		showTrimControls = false;
		showReplaceControls = false;
		if (regions) {
			regions.clearRegions();
		}
		activeRegion = null;
		dispatch("volumeEnabled");

		// Auto-analyze audio when opening volume controls
		if (!audioAnalysis && audioUrl) {
			await analyzeVolume();
		}
	}

	async function analyzeVolume() {
		if (!audioUrl) return;

		isAnalyzing = true;
		try {
			audioAnalysis = await analyzeAudioLevels(audioUrl);
			// Auto-apply suggested gain
			if (audioAnalysis.suggestedGainDb !== 0) {
				volumeAdjustment = audioAnalysis.suggestedGainDb;
				if (gainNode && audioContext) {
					updateGainNode(gainNode, volumeAdjustment, audioContext);
				}
			}
		} catch (error) {
			console.error("Failed to analyze audio levels:", error);
		} finally {
			isAnalyzing = false;
		}
	}

	function adjustVolume(event: Event) {
		const input = event.target as HTMLInputElement;
		volumeAdjustment = parseFloat(input.value);
	}

	function resetVolume() {
		volumeAdjustment = 0;
		useCompression = false;
		useLeveling = false;
		compressionStrength = "medium";
	}

	async function togglePreview() {
		if (isPlayingPreview) {
			stopPreview();
		} else {
			await playPreview();
		}
	}

	async function playPreview() {
		if (isProcessingPreview) return;

		isProcessingPreview = true;

		try {
			let mode: "simple" | "leveling" | "compression" = "simple";
			if (useLeveling) mode = "leveling";
			else if (useCompression) mode = "compression";

			const options = createNormalizationOptions(mode, volumeAdjustment, compressionStrength);

			// Clean up previous preview if exists
			if (previewUrl) {
				revokePreviewUrl(previewUrl);
			}

			const { previewUrl: newPreviewUrl, blob } = await createNormalizedPreview(audioUrl, options);
			previewUrl = newPreviewUrl;
			previewBlob = blob;

			// Play the preview
			if (previewAudioElement) {
				previewAudioElement.src = previewUrl;
				await previewAudioElement.play();
				isPlayingPreview = true;
			}
		} catch (error) {
			console.error("Failed to play preview:", error);
			isPlayingPreview = false;
		} finally {
			isProcessingPreview = false;
		}
	}

	function stopPreview() {
		if (previewAudioElement) {
			previewAudioElement.pause();
			previewAudioElement.currentTime = 0;
		}
		isPlayingPreview = false;
	}

	async function restartPreview() {
		stopPreview();
		// Small delay to ensure UI updates
		setTimeout(() => {
			playPreview();
		}, 100);
	}

	function applyNormalization() {
		if (!previewBlob) return;

		let mode: "simple" | "leveling" | "compression" = "simple";
		if (useLeveling) mode = "leveling";
		else if (useCompression) mode = "compression";

		const options = createNormalizationOptions(mode, volumeAdjustment, compressionStrength);

		dispatch("normalize", { ...options, previewBlob });
		cancelVolumeAdjust();
	}

	function cancelVolumeAdjust() {
		resetVolume();
		showVolumeControls = false;
		audioAnalysis = null;
		useCompression = false;
		useLeveling = false;
		compressionStrength = "medium";

		// Clean up preview if exists
		stopPreview();
		if (previewUrl) {
			revokePreviewUrl(previewUrl);
			previewUrl = null;
		}
		previewBlob = null;
		isPlayingPreview = false;

		dispatch("volumeCancelled");
	}

	// Setup preview audio element events
	$: if (previewAudioElement) {
		previewAudioElement.onended = () => {
			isPlayingPreview = false;
		};
		previewAudioElement.onerror = () => {
			isPlayingPreview = false;
		};
	}
</script>

<!-- Hidden audio element for synchronization -->
<audio bind:this={audioElement} style="display: none;" />

<!-- Hidden preview audio element -->
<audio bind:this={previewAudioElement} style="display: none;" />

<!-- Hidden file input for audio replacement -->
<input
	bind:this={fileInput}
	type="file"
	accept="audio/*"
	on:change={handleFileSelect}
	style="display: none;"
/>

<div class="audio-player">
	<div bind:this={waveformContainer} class="waveform-container mb-3"></div>

	{#if wavesurfer}
		<div class="field">
			<div class="buttons">
				<button class="button is-info is-dark is-small" on:click={togglePlayPause} type="button">
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

				{#if enableTrimming && !showTrimControls && !showReplaceControls && !showVolumeControls}
					<button
						class="button is-info is-light is-outlined is-warning is-small"
						on:click={enableTrim}
						type="button"
					>
						<span class="icon">
							<Scissors size={16} />
						</span>
						<span>Trimma</span>
					</button>
				{/if}

				{#if enableVolumeControl && !showVolumeControls && !showTrimControls && !showReplaceControls}
					<button
						class="button is-warning is-light is-outlined is-small"
						on:click={enableVolumeAdjust}
						type="button"
					>
						<span class="icon">
							<Volume2 size={16} />
						</span>
						<span>Justera volym</span>
					</button>
				{/if}

				{#if enableReplacement && !showReplaceControls && !showTrimControls && !showVolumeControls}
					<button
						class="button is-warning is-outlined is-small"
						on:click={enableReplace}
						type="button"
					>
						<span class="icon">
							<Upload size={16} />
						</span>
						<span>Ersätt ljudfil</span>
					</button>
				{/if}
			</div>
		</div>

		{#if showTrimControls && activeRegion}
			<div class="notification is-warning is-light mt-3">
				<p class="mb-2">
					<strong>Trimma ljudfil</strong>
				</p>
				<p class="mb-3">
					Dra i kanterna på det markerade området för att välja vilken del som ska behållas. Start: {trimStart.toFixed(
						1
					)}s - Slut: {trimEnd.toFixed(1)}s
				</p>
				<div class="buttons">
					<button class="button is-warning is-dark is-small" on:click={applyTrim} type="button">
						<span class="icon">
							<Scissors size={16} />
						</span>
						<span>Tillämpa trimning</span>
					</button>
					<button class="button is-small" on:click={cancelTrim} type="button"> Avbryt </button>
				</div>
			</div>
		{/if}

		{#if showReplaceControls}
			<div class="notification is-warning is-light mt-3">
				<p class="mb-2">
					<strong>Ersätt ljudfil</strong>
				</p>
				<p class="mb-3">
					Välj en ny ljudfil för att ersätta den nuvarande inspelningen. Alla ljudformat stöds och
					konverteras automatiskt till MP3 vid behov.
				</p>
				<div class="buttons">
					<button
						class="button is-warning is-small"
						on:click={() => fileInput?.click()}
						type="button"
					>
						<span class="icon">
							<Upload size={16} />
						</span>
						<span>Välj fil</span>
					</button>
					<button class="button is-small" on:click={cancelReplace} type="button"> Avbryt </button>
				</div>
			</div>
		{/if}

		{#if showVolumeControls}
			<div class="notification is-warning is-light mt-3">
				<p class="mb-2">
					<strong>Justera ljudvolym</strong>
					{#if isPlayingPreview}
						<span class="tag is-warning ml-2">Spelar förhandsgranskning</span>
					{/if}
				</p>

				{#if isAnalyzing}
					<p class="mb-3">
						<span>Analyserar ljudnivåer...</span>
					</p>
				{:else if audioAnalysis}
					<div class="box mb-3">
						<p class="is-size-7">
							<strong>Analys:</strong><br />
							Toppnivå: {audioAnalysis.peakDb} dB<br />
							RMS-nivå: {audioAnalysis.rmsDb} dB<br />
							Dynamiskt omfång: {audioAnalysis.dynamicRange} dB<br />
							Föreslagen justering: {audioAnalysis.suggestedGainDb} dB
							{#if audioAnalysis.clipsAtCurrentLevel}
								<br /><span class="has-text-danger">⚠️ Ljudet klippar vid nuvarande nivå</span>
							{/if}
							{#if audioAnalysis.needsCompression}
								<br /><span class="has-text-info">💡 Ljudet har stora volymskillnader</span>
							{/if}
						</p>
					</div>

					<div class="field">
						<label class="checkbox">
							<input type="checkbox" bind:checked={useLeveling} disabled={useCompression} />
							<span class="ml-2">Jämna ut ljudnivåer (höjer tysta delar)</span>
						</label>
					</div>

					<div class="field">
						<label class="checkbox">
							<input type="checkbox" bind:checked={useCompression} disabled={useLeveling} />
							<span class="ml-2">Använd kompression (minskar volymskillnader)</span>
						</label>
					</div>

					{#if useCompression}
						<div class="field">
							<label for="compression-select" class="label is-small">Kompressionsstyrka</label>
							<div class="control">
								<div class="select is-small">
									<select id="compression-select" bind:value={compressionStrength}>
										<option value="light">Lätt (2:1)</option>
										<option value="medium">Medium (4:1)</option>
										<option value="heavy">Kraftig (8:1)</option>
									</select>
								</div>
							</div>
						</div>
					{/if}
				{/if}

				<div class="field mt-3">
					<label for="volume-slider" class="label is-small">
						Volymjustering: {volumeAdjustment > 0 ? "+" : ""}{volumeAdjustment} dB
						{#if clippingWarning && !useLeveling && !useCompression}
							<span class="has-text-danger ml-2">
								<AlertTriangle
									size={14}
									style="display: inline-block; vertical-align: text-bottom;"
								/>
								Risk för klippning!
							</span>
						{/if}
					</label>
					<div class="control">
						<input
							id="volume-slider"
							type="range"
							class="slider is-fullwidth"
							class:is-danger={clippingWarning}
							min="-20"
							max="20"
							step="0.5"
							bind:value={volumeAdjustment}
							on:input={adjustVolume}
						/>
					</div>
					<div class="is-size-7 has-text-grey is-flex is-justify-content-space-between mt-1">
						<span>-20 dB</span>
						<span>0 dB</span>
						<span>+20 dB</span>
					</div>
				</div>

				<div class="level">
					<div class="level-left">
						{#if !isPlayingPreview}
							<div class="level-item">
								<button
									class="button is-warning is-small"
									on:click={playPreview}
									type="button"
									disabled={(volumeAdjustment === 0 && !useCompression && !useLeveling) ||
										isProcessingPreview}
								>
									{#if isProcessingPreview}
										<span>Bearbetar...</span>
									{:else}
										<span class="icon">
											<Play size={16} />
										</span>
										<span>Spela förhandsgranskning</span>
									{/if}
								</button>
							</div>
						{:else}
							<div class="level-item">
								<button class="button is-small is-warning" on:click={stopPreview} type="button">
									<span class="icon">
										<Pause size={16} />
									</span>
									<span>Stoppa förhandsgranskning</span>
								</button>
							</div>
						{/if}

						<div class="level-item">
							<button
								class="button is-small"
								on:click={resetVolume}
								type="button"
								disabled={volumeAdjustment === 0 && !useCompression && !useLeveling}
							>
								Återställ
							</button>

							<button class="button is-small" on:click={cancelVolumeAdjust} type="button">
								Stäng
							</button>
						</div>
					</div>
					<div class="level-right">
						{#if previewBlob && !isProcessingPreview}
							<div class="level-item">
								<button
									class="button is-primary is-small"
									on:click={applyNormalization}
									type="button"
								>
									<span class="icon">
										<Volume2 size={16} />
									</span>
									<span>Tillämpa permanent</span>
								</button>
							</div>
						{/if}
					</div>
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

	.slider {
		width: 100%;
	}

	.slider.is-danger {
		accent-color: #f14668;
	}
</style>
