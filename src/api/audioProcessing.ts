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
		waveColor: config.waveColor || "#3273dc",
		progressColor: config.progressColor || "#00d1b2",
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
		color: "rgba(255, 165, 0, 0.3)",
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
