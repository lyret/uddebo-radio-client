/**
 * Audio processing utilities
 * Handles audio file processing, waveform generation, and trimming
 */

import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import type { Region } from "wavesurfer.js/dist/plugins/regions.js";

/**
 * Gets the duration of an audio file
 */
export async function getAudioDuration(file: File): Promise<number> {
	return new Promise((resolve) => {
		const audio = new Audio();
		audio.addEventListener("loadedmetadata", () => {
			resolve(Math.round(audio.duration));
		});
		audio.addEventListener("error", () => {
			resolve(0);
		});
		audio.src = URL.createObjectURL(file);
	});
}

/**
 * Configuration for waveform initialization
 */
export interface WaveformConfig {
	container: HTMLElement;
	url: string;
	height?: number;
	waveColor?: string;
	progressColor?: string;
	cursorColor?: string;
	normalize?: boolean;
}

/**
 * Initializes a WaveSurfer instance with regions
 */
export async function initializeWaveform(config: WaveformConfig): Promise<{
	wavesurfer: WaveSurfer;
	regions: RegionsPlugin;
}> {
	const wavesurfer = WaveSurfer.create({
		container: config.container,
		waveColor: config.waveColor || "#2dfff9",
		progressColor: config.progressColor || "#41cdcb",
		cursorColor: config.cursorColor || "#41cdcb",
		url: config.url,
		height: config.height || 100,
		normalize: config.normalize ?? true,
		backend: "WebAudio",
	});

	const regions = wavesurfer.registerPlugin(RegionsPlugin.create());

	// Wait for waveform to load
	await new Promise<void>((resolve) => {
		wavesurfer.on("ready", () => resolve());
	});

	return { wavesurfer, regions };
}

/**
 * Creates a trim region on the waveform
 */
export function createTrimRegion(regions: RegionsPlugin, start: number, end: number): Region {
	// Clear existing regions
	regions.clearRegions();

	// Add new region
	return regions.addRegion({
		start,
		end,
		color: "rgba(212, 176, 19, 0.3)",
		drag: true,
		resize: true,
	});
}

/**
 * Converts an audio buffer to a WAV blob
 */
export async function audioBufferToWavBlob(audioBuffer: AudioBuffer): Promise<Blob> {
	const offlineContext = new OfflineAudioContext(
		audioBuffer.numberOfChannels,
		audioBuffer.length,
		audioBuffer.sampleRate
	);

	const source = offlineContext.createBufferSource();
	source.buffer = audioBuffer;
	source.connect(offlineContext.destination);
	source.start();

	const renderedBuffer = await offlineContext.startRendering();

	// Create WAV file
	const length = renderedBuffer.length * renderedBuffer.numberOfChannels * 2 + 44;
	const arrayBuffer = new ArrayBuffer(length);
	const view = new DataView(arrayBuffer);
	const channels: Float32Array[] = [];
	let offset = 0;
	let pos = 0;

	// Helper functions for writing data
	const setUint16 = (data: number) => {
		view.setUint16(pos, data, true);
		pos += 2;
	};

	const setUint32 = (data: number) => {
		view.setUint32(pos, data, true);
		pos += 4;
	};

	// Write WAV header
	pos = 0;
	// "RIFF"
	setUint32(0x46464952);
	// file length - 8
	setUint32(length - 8);
	// "WAVE"
	setUint32(0x45564157);
	// "fmt " chunk
	setUint32(0x20746d66);
	// length = 16
	setUint32(16);
	// PCM format
	setUint16(1);
	// number of channels
	setUint16(renderedBuffer.numberOfChannels);
	// sample rate
	setUint32(renderedBuffer.sampleRate);
	// byte rate
	setUint32(renderedBuffer.sampleRate * 2 * renderedBuffer.numberOfChannels);
	// block align
	setUint16(renderedBuffer.numberOfChannels * 2);
	// bits per sample
	setUint16(16);
	// "data" chunk
	setUint32(0x61746164);
	// data chunk length
	setUint32(length - pos - 4);

	// Get audio data from all channels
	for (let i = 0; i < renderedBuffer.numberOfChannels; i++) {
		channels.push(renderedBuffer.getChannelData(i));
	}

	// Interleave channels and convert to 16-bit PCM
	offset = pos;
	for (let i = 0; i < renderedBuffer.length; i++) {
		for (let channel = 0; channel < renderedBuffer.numberOfChannels; channel++) {
			let sample = Math.max(-1, Math.min(1, channels[channel][i]));
			sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
			view.setInt16(pos, sample, true);
			pos += 2;
		}
	}

	return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * Trims an audio file using the Web Audio API
 */
export async function trimAudioFile(
	audioUrl: string,
	startTime: number,
	endTime: number
): Promise<Blob> {
	// Fetch and decode the audio file
	const response = await fetch(audioUrl);
	const arrayBuffer = await response.arrayBuffer();
	const audioContext = new AudioContext();
	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

	// Calculate sample positions
	const sampleRate = audioBuffer.sampleRate;
	const startSample = Math.floor(startTime * sampleRate);
	const endSample = Math.floor(endTime * sampleRate);
	const trimmedLength = endSample - startSample;

	// Create a new buffer with trimmed audio
	const trimmedBuffer = audioContext.createBuffer(
		audioBuffer.numberOfChannels,
		trimmedLength,
		sampleRate
	);

	// Copy trimmed audio data
	for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
		const originalData = audioBuffer.getChannelData(channel);
		const trimmedData = trimmedBuffer.getChannelData(channel);
		for (let i = 0; i < trimmedLength; i++) {
			trimmedData[i] = originalData[startSample + i];
		}
	}

	// Convert to WAV blob
	return audioBufferToWavBlob(trimmedBuffer);
}

/**
 * Syncs waveform with an audio element
 */
export function syncWaveformWithAudio(
	wavesurfer: WaveSurfer,
	audioElement: HTMLAudioElement
): void {
	if (!audioElement || !wavesurfer) return;

	const currentTime = audioElement.currentTime;
	const duration = audioElement.duration;

	if (!isNaN(currentTime) && !isNaN(duration) && duration > 0) {
		const progress = currentTime / duration;
		wavesurfer.seekTo(progress);
	}
}

/**
 * Formats duration in seconds to MM:SS format
 */
export function formatDuration(seconds: number): string {
	if (!seconds || seconds === 0) return "0:00";

	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	const formattedSeconds = remainingSeconds.toString().padStart(2, "0");

	return `${minutes}:${formattedSeconds}`;
}

// needsAudioConversion is exported from audioConverter.ts

/**
 * Options for audio normalization
 */
export interface NormalizationOptions {
	gainDb: number;
	useCompression?: boolean;
	useLeveling?: boolean;
	compressionRatio?: number;
	compressionThreshold?: number;
	levelingTarget?: number;
	showProgress?: boolean;
}

/**
 * Creates default normalization options based on processing mode
 */
export function createNormalizationOptions(
	mode: "simple" | "leveling" | "compression",
	gainDb: number = 0,
	strength: "light" | "medium" | "heavy" = "medium"
): NormalizationOptions {
	const compressionRatios = {
		light: 2,
		medium: 4,
		heavy: 8,
	};

	switch (mode) {
		case "leveling":
			return {
				gainDb: 0,
				useLeveling: true,
				useCompression: false,
				levelingTarget: -16,
				showProgress: true,
			};
		case "compression":
			return {
				gainDb,
				useCompression: true,
				useLeveling: false,
				compressionRatio: compressionRatios[strength],
				compressionThreshold: -24,
				showProgress: true,
			};
		case "simple":
		default:
			return {
				gainDb,
				useCompression: false,
				useLeveling: false,
				showProgress: true,
			};
	}
}

/**
 * Analyzes audio levels and suggests optimal gain adjustment
 */
export async function analyzeAudioLevels(audioUrl: string): Promise<{
	peakDb: number;
	rmsDb: number;
	suggestedGainDb: number;
	clipsAtCurrentLevel: boolean;
	dynamicRange: number;
	needsCompression: boolean;
}> {
	// Fetch and decode the audio file
	const response = await fetch(audioUrl);
	const arrayBuffer = await response.arrayBuffer();
	const audioContext = new AudioContext();
	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

	let peak = 0;
	let sumSquares = 0;
	let totalSamples = 0;
	let clippedSamples = 0;

	// Analyze all channels
	for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
		const channelData = audioBuffer.getChannelData(channel);
		for (let i = 0; i < channelData.length; i++) {
			const sample = Math.abs(channelData[i]);
			peak = Math.max(peak, sample);
			sumSquares += channelData[i] * channelData[i];
			totalSamples++;

			// Check for clipping (samples at or very close to 1.0)
			if (sample >= 0.999) {
				clippedSamples++;
			}
		}
	}

	// Calculate RMS (Root Mean Square) for perceived loudness
	const rms = Math.sqrt(sumSquares / totalSamples);

	// Convert to decibels
	const peakDb = 20 * Math.log10(Math.max(peak, 0.00001));
	const rmsDb = 20 * Math.log10(Math.max(rms, 0.00001));

	// Calculate dynamic range (difference between peak and RMS)
	const dynamicRange = peakDb - rmsDb;

	// Target levels for normalization
	const targetPeakDb = -3; // Leave 3dB headroom
	const targetRmsDb = -16; // Typical broadcast loudness

	// Calculate suggested gain based on RMS (better for perceived loudness)
	let suggestedGainDb = targetRmsDb - rmsDb;

	// But limit it so peaks don't clip
	const peakHeadroom = targetPeakDb - peakDb;
	suggestedGainDb = Math.min(suggestedGainDb, peakHeadroom);

	// Limit maximum gain to avoid excessive amplification of quiet recordings
	suggestedGainDb = Math.min(suggestedGainDb, 20);
	suggestedGainDb = Math.max(suggestedGainDb, -20);

	return {
		peakDb: Math.round(peakDb * 10) / 10,
		rmsDb: Math.round(rmsDb * 10) / 10,
		suggestedGainDb: Math.round(suggestedGainDb * 10) / 10,
		clipsAtCurrentLevel: clippedSamples > 10,
		dynamicRange: Math.round(dynamicRange * 10) / 10,
		needsCompression: dynamicRange > 20, // Suggest compression if dynamic range > 20dB
	};
}

/**
 * Applies gain adjustment to an audio buffer with soft limiting
 */
export function applyGainToBuffer(audioBuffer: AudioBuffer, gainDb: number): AudioBuffer {
	const audioContext = new AudioContext();
	const gain = Math.pow(10, gainDb / 20);

	// Create a new buffer with the same properties
	const processedBuffer = audioContext.createBuffer(
		audioBuffer.numberOfChannels,
		audioBuffer.length,
		audioBuffer.sampleRate
	);

	// Apply gain with soft limiting to prevent clipping
	for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
		const inputData = audioBuffer.getChannelData(channel);
		const outputData = processedBuffer.getChannelData(channel);

		for (let i = 0; i < inputData.length; i++) {
			let sample = inputData[i] * gain;

			// Soft limiting using tanh (hyperbolic tangent) for smooth saturation
			// This prevents harsh clipping while maintaining loudness
			if (Math.abs(sample) > 0.95) {
				sample = Math.tanh(sample * 0.7) * 1.3;
			}

			// Hard limit as safety
			sample = Math.max(-1, Math.min(1, sample));

			outputData[i] = sample;
		}
	}

	return processedBuffer;
}

/**
 * Applies dynamic range compression to an audio buffer
 * This makes quiet parts louder while keeping loud parts controlled
 */
export function applyCompressionToBuffer(
	audioBuffer: AudioBuffer,
	threshold: number = -24, // dB - level above which compression starts
	ratio: number = 4, // compression ratio (4:1 means 4dB input becomes 1dB output above threshold)
	makeupGain: number = 0 // dB - additional gain after compression
): AudioBuffer {
	const audioContext = new AudioContext();
	const compressedBuffer = audioContext.createBuffer(
		audioBuffer.numberOfChannels,
		audioBuffer.length,
		audioBuffer.sampleRate
	);

	// Convert threshold from dB to linear
	const thresholdLinear = Math.pow(10, threshold / 20);

	// Attack and release times in samples (for smooth compression)
	const attackTime = 0.003; // 3ms
	const releaseTime = 0.1; // 100ms
	const attackSamples = Math.floor(attackTime * audioBuffer.sampleRate);
	const releaseSamples = Math.floor(releaseTime * audioBuffer.sampleRate);

	for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
		const inputData = audioBuffer.getChannelData(channel);
		const outputData = compressedBuffer.getChannelData(channel);

		let envelope = 0;

		for (let i = 0; i < inputData.length; i++) {
			const inputSample = inputData[i];
			const inputLevel = Math.abs(inputSample);

			// Update envelope (smooth level detection)
			const targetEnvelope = inputLevel;
			const rate = targetEnvelope > envelope ? attackSamples : releaseSamples;
			envelope += (targetEnvelope - envelope) / rate;

			// Apply compression if above threshold
			let outputSample = inputSample;
			if (envelope > thresholdLinear) {
				// Calculate gain reduction
				const overThreshold = envelope / thresholdLinear;
				const compressedOver = Math.pow(overThreshold, 1 / ratio - 1);
				const gainReduction = compressedOver;

				outputSample = inputSample * gainReduction;
			}

			// Apply makeup gain
			const makeupLinear = Math.pow(10, makeupGain / 20);
			outputSample *= makeupLinear;

			// Soft limiting to prevent clipping
			if (Math.abs(outputSample) > 0.95) {
				outputSample = Math.tanh(outputSample * 0.7) * 1.3;
			}

			outputData[i] = Math.max(-1, Math.min(1, outputSample));
		}
	}

	return compressedBuffer;
}

/**
 * Applies leveling to audio (boosts quiet sections more than loud sections)
 * This is a gentler alternative to compression
 */
export function applyLevelingToBuffer(
	audioBuffer: AudioBuffer,
	targetLevel: number = -16 // Target RMS in dB
): AudioBuffer {
	const audioContext = new AudioContext();
	const leveledBuffer = audioContext.createBuffer(
		audioBuffer.numberOfChannels,
		audioBuffer.length,
		audioBuffer.sampleRate
	);

	// Window size for RMS calculation (50ms windows)
	const windowSize = Math.floor(0.05 * audioBuffer.sampleRate);
	const hopSize = Math.floor(windowSize / 2);

	for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
		const inputData = audioBuffer.getChannelData(channel);
		const outputData = leveledBuffer.getChannelData(channel);

		// Calculate RMS for each window
		const gains = new Float32Array(Math.ceil(inputData.length / hopSize));

		for (let w = 0; w < gains.length; w++) {
			const start = w * hopSize;
			const end = Math.min(start + windowSize, inputData.length);

			// Calculate RMS for this window
			let sumSquares = 0;
			for (let i = start; i < end; i++) {
				sumSquares += inputData[i] * inputData[i];
			}
			const rms = Math.sqrt(sumSquares / (end - start));
			const rmsDb = 20 * Math.log10(Math.max(rms, 0.00001));

			// Calculate gain needed to reach target level
			const gainDb = targetLevel - rmsDb;
			// Limit gain to reasonable range
			const limitedGainDb = Math.max(-10, Math.min(20, gainDb));
			gains[w] = Math.pow(10, limitedGainDb / 20);
		}

		// Apply smoothed gains
		for (let i = 0; i < inputData.length; i++) {
			const windowIndex = Math.floor(i / hopSize);
			const nextWindowIndex = Math.min(windowIndex + 1, gains.length - 1);
			const windowProgress = (i % hopSize) / hopSize;

			// Interpolate between window gains for smooth transition
			const gain =
				gains[windowIndex] * (1 - windowProgress) + gains[nextWindowIndex] * windowProgress;

			let outputSample = inputData[i] * gain;

			// Soft limiting
			if (Math.abs(outputSample) > 0.95) {
				outputSample = Math.tanh(outputSample * 0.7) * 1.3;
			}

			outputData[i] = Math.max(-1, Math.min(1, outputSample));
		}
	}

	return leveledBuffer;
}

/**
 * Normalizes audio and returns a new encoded blob
 */
export async function normalizeAndEncode(
	audioUrl: string,
	gainDb: number,
	options?: {
		useCompression?: boolean;
		useLeveling?: boolean;
		compressionThreshold?: number;
		compressionRatio?: number;
		levelingTarget?: number;
	}
): Promise<{ blob: Blob; format: "wav" }> {
	// Fetch and decode the audio file
	const response = await fetch(audioUrl);
	const arrayBuffer = await response.arrayBuffer();
	const audioContext = new AudioContext();
	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

	// Apply processing chain
	let processedBuffer = audioBuffer;

	// Apply leveling first if requested (gentler, preserves dynamics better)
	if (options?.useLeveling) {
		processedBuffer = applyLevelingToBuffer(processedBuffer, options.levelingTarget ?? -16);
	}

	// Apply compression if requested (more aggressive, reduces dynamic range)
	if (options?.useCompression) {
		const makeupGain = options.useLeveling ? 0 : gainDb; // Add makeup gain only if not leveling
		processedBuffer = applyCompressionToBuffer(
			processedBuffer,
			options.compressionThreshold ?? -24,
			options.compressionRatio ?? 4,
			makeupGain
		);
	}

	// Apply simple gain adjustment if neither compression nor leveling is used
	if (!options?.useCompression && !options?.useLeveling) {
		processedBuffer = applyGainToBuffer(processedBuffer, gainDb);
	}

	// Convert to WAV blob (will be converted to MP3 by existing pipeline if needed)
	const wavBlob = await audioBufferToWavBlob(processedBuffer);

	return { blob: wavBlob, format: "wav" };
}

/**
 * Creates a preview URL for normalized audio without uploading
 */
export async function createNormalizedPreview(
	audioUrl: string,
	options: NormalizationOptions
): Promise<{ previewUrl: string; blob: Blob }> {
	const { gainDb, useCompression, useLeveling, compressionRatio } = options;

	// Process the audio
	const { blob } = await normalizeAndEncode(audioUrl, gainDb || 0, {
		useCompression,
		useLeveling,
		compressionRatio: compressionRatio || 4,
		compressionThreshold: options.compressionThreshold || -24,
		levelingTarget: options.levelingTarget || -16,
	});

	// Create a temporary URL for preview
	const previewUrl = URL.createObjectURL(blob);

	return { previewUrl, blob };
}

/**
 * Cleans up a preview URL created by createNormalizedPreview
 */
export function revokePreviewUrl(url: string): void {
	if (url && url.startsWith("blob:")) {
		URL.revokeObjectURL(url);
	}
}

/**
 * Creates a gain node for real-time preview
 */
export function createGainNode(audioContext: AudioContext, gainDb: number): GainNode {
	const gainNode = audioContext.createGain();
	const gain = Math.pow(10, gainDb / 20);
	gainNode.gain.setValueAtTime(gain, audioContext.currentTime);
	return gainNode;
}

/**
 * Updates gain node value smoothly
 */
export function updateGainNode(
	gainNode: GainNode,
	gainDb: number,
	audioContext: AudioContext
): void {
	const gain = Math.pow(10, gainDb / 20);
	gainNode.gain.exponentialRampToValueAtTime(
		Math.max(0.0001, gain),
		audioContext.currentTime + 0.1
	);
}

/**
 * Detects if applying gain will cause clipping
 */
export function willClip(peakDb: number, gainDb: number): boolean {
	return peakDb + gainDb > -0.1; // Leave small headroom
}
