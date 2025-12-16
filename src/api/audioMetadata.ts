/**
 * Module for extracting audio metadata including encoding information
 */

import { getAudioFormatDescription } from "./audioConverter";

/**
 * Audio metadata information
 */
export interface AudioMetadata {
	format: string;
	mimeType: string;
	sampleRate: number | null;
	channels: number | null;
	bitrate: number | null;
	duration: number;
}

/**
 * Extracts audio metadata from a file URL
 * @param audioUrl URL of the audio file
 * @returns Audio metadata including encoding information
 */
export async function extractAudioMetadata(audioUrl: string): Promise<AudioMetadata> {
	try {
		// Fetch the audio file
		const response = await fetch(audioUrl);
		const contentType = response.headers.get("content-type") || "audio/unknown";
		const arrayBuffer = await response.arrayBuffer();

		// Create audio context to decode the audio
		const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

		// Extract format from URL extension
		const urlParts = audioUrl.split(".");
		const extension = urlParts[urlParts.length - 1].toLowerCase().split("?")[0];
		const format = getFormatFromExtension(extension);

		// Estimate bitrate (approximate based on file size and duration)
		const fileSizeInBits = arrayBuffer.byteLength * 8;
		const estimatedBitrate = Math.round(fileSizeInBits / audioBuffer.duration / 1000); // in kbps

		return {
			format,
			mimeType: contentType,
			sampleRate: audioBuffer.sampleRate,
			channels: audioBuffer.numberOfChannels,
			bitrate: estimatedBitrate,
			duration: audioBuffer.duration
		};
	} catch (error) {
		console.error("Error extracting audio metadata:", error);
		// Return partial metadata if audio decoding fails
		return {
			format: "Unknown",
			mimeType: "audio/unknown",
			sampleRate: null,
			channels: null,
			bitrate: null,
			duration: 0
		};
	}
}

/**
 * Extracts audio metadata from a File object
 * @param file Audio file
 * @returns Audio metadata including encoding information
 */
export async function extractAudioMetadataFromFile(file: File): Promise<AudioMetadata> {
	try {
		const arrayBuffer = await file.arrayBuffer();

		// Create audio context to decode the audio
		const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

		// Extract format from file extension
		const extension = file.name.split(".").pop()?.toLowerCase() || "unknown";
		const format = getFormatFromExtension(extension);

		// Estimate bitrate (approximate based on file size and duration)
		const fileSizeInBits = file.size * 8;
		const estimatedBitrate = Math.round(fileSizeInBits / audioBuffer.duration / 1000); // in kbps

		return {
			format,
			mimeType: file.type || "audio/unknown",
			sampleRate: audioBuffer.sampleRate,
			channels: audioBuffer.numberOfChannels,
			bitrate: estimatedBitrate,
			duration: audioBuffer.duration
		};
	} catch (error) {
		console.error("Error extracting audio metadata from file:", error);
		// Return partial metadata if audio decoding fails
		return {
			format: getAudioFormatDescription(file),
			mimeType: file.type || "audio/unknown",
			sampleRate: null,
			channels: null,
			bitrate: null,
			duration: 0
		};
	}
}

/**
 * Gets a human-readable format name from file extension
 * @param extension File extension
 * @returns Format name
 */
function getFormatFromExtension(extension: string): string {
	const formats: Record<string, string> = {
		"mp3": "MP3",
		"wav": "WAV",
		"m4a": "M4A/AAC",
		"ogg": "OGG Vorbis",
		"webm": "WebM",
		"flac": "FLAC",
		"aac": "AAC",
		"opus": "Opus",
		"weba": "WebM Audio",
		"mp4": "MP4 Audio"
	};

	return formats[extension] || extension.toUpperCase();
}

/**
 * Formats sample rate for display
 * @param sampleRate Sample rate in Hz
 * @returns Formatted sample rate string
 */
export function formatSampleRate(sampleRate: number | null): string {
	if (!sampleRate) return "Okänd";
	return `${(sampleRate / 1000).toFixed(1)} kHz`;
}

/**
 * Formats bitrate for display
 * @param bitrate Bitrate in kbps
 * @returns Formatted bitrate string
 */
export function formatBitrate(bitrate: number | null): string {
	if (!bitrate) return "Okänd";
	return `${bitrate} kbps`;
}

/**
 * Formats channel count for display
 * @param channels Number of channels
 * @returns Formatted channel string
 */
export function formatChannels(channels: number | null): string {
	if (!channels) return "Okänd";
	if (channels === 1) return "Mono";
	if (channels === 2) return "Stereo";
	return `${channels} kanaler`;
}

/**
 * Gets a complete audio encoding description
 * @param metadata Audio metadata
 * @returns Complete encoding description string
 */
export function getAudioEncodingDescription(metadata: AudioMetadata): string {
	const parts = [metadata.format];

	if (metadata.sampleRate) {
		parts.push(formatSampleRate(metadata.sampleRate));
	}

	if (metadata.bitrate) {
		parts.push(formatBitrate(metadata.bitrate));
	}

	if (metadata.channels) {
		parts.push(formatChannels(metadata.channels));
	}

	return parts.join(", ");
}
