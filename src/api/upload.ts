/**
 * Centralized upload utility for audio files with automatic MP3 conversion
 */

import {
	convertAudioToMp3,
	needsAudioConversion,
	getAudioFormatDescription,
	validateAudioFile,
} from "./audioConverter";
import { toast } from "svelte-sonner";

/**
 * Options for processing audio files before upload
 */
export interface AudioUploadOptions {
	/** The audio file to upload */
	file: File;
	/** @deprecated No longer used — PocketBase stores files on the record */
	bucket?: string;
	/** @deprecated No longer used */
	folder?: string;
	/** Whether to show progress notifications */
	showProgress?: boolean;
	/** Whether to convert to MP3 if needed */
	autoConvert?: boolean;
	/** Maximum file size in MB */
	maxSizeMB?: number;
}

/**
 * Result of audio processing (conversion + duration extraction)
 */
export interface AudioUploadResult {
	/** Final file to attach to the PocketBase record */
	file: File;
	/** Duration of the audio in seconds */
	duration: number;
	/** Whether the file was converted */
	wasConverted: boolean;
	/** Original file info if converted */
	originalFile?: {
		name: string;
		size: number;
		type: string;
	};
}

/**
 * Processes an audio file (validates, converts if needed, extracts duration).
 * The returned file should be passed directly to the PocketBase record create/update.
 */
export async function uploadAudioFile(options: AudioUploadOptions): Promise<AudioUploadResult> {
	const {
		file: inputFile,
		showProgress = true,
		autoConvert = true,
		maxSizeMB = 50,
	} = options;

	let fileToUpload = inputFile;
	let wasConverted = false;
	let duration = 0;
	let originalFileInfo = undefined;

	try {
		// Validate the input file
		const validationError = validateAudioFile(inputFile, maxSizeMB);
		if (validationError) {
			throw new Error(validationError);
		}

		// Check if conversion is needed
		if (autoConvert && needsAudioConversion(inputFile)) {
			if (showProgress) {
				toast.info(`Konverterar ${getAudioFormatDescription(inputFile)} till MP3...`, {
					description: "Detta säkerställer kompatibilitet med alla enheter",
				});
			}

			const conversionResult = await convertAudioToMp3(inputFile, {
				bitrate: 128,
				showProgress,
			});

			fileToUpload = conversionResult.file;
			duration = conversionResult.duration;
			wasConverted = true;
			originalFileInfo = conversionResult.originalFile;
		} else {
			// Get duration for non-converted files
			const audio = new Audio();
			audio.src = URL.createObjectURL(fileToUpload);

			await new Promise((resolve, reject) => {
				audio.addEventListener("loadedmetadata", resolve);
				audio.addEventListener("error", reject);
				audio.load();
			});

			duration = Math.floor(audio.duration);
			URL.revokeObjectURL(audio.src);
		}

		if (showProgress) {
			toast.success("Ljudfil bearbetad!", { id: "audio-upload" });
		}

		return {
			file: fileToUpload,
			duration,
			wasConverted,
			originalFile: originalFileInfo,
		};
	} catch (error) {
		if (showProgress) {
			toast.error("Bearbetning misslyckades", {
				id: "audio-upload",
				description: error instanceof Error ? error.message : "Ett okänt fel uppstod",
			});
		}
		throw error;
	}
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 Bytes";
	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
