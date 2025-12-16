/**
 * Centralized upload utility for audio files with automatic MP3 conversion
 */

import { supabase } from "./supabase";
import { convertAudioToMp3, needsAudioConversion, getAudioFormatDescription, validateAudioFile } from "./audioConverter";
import { getFilenameWithDate } from "./filename";
import { toast } from "svelte-sonner";

/**
 * Options for uploading audio files
 */
export interface AudioUploadOptions {
	/** The audio file to upload */
	file: File;
	/** Storage bucket name */
	bucket?: string;
	/** Custom path/folder within the bucket */
	folder?: string;
	/** Whether to show progress notifications */
	showProgress?: boolean;
	/** Whether to convert to MP3 if needed */
	autoConvert?: boolean;
	/** Maximum file size in MB */
	maxSizeMB?: number;
}

/**
 * Result of audio upload operation
 */
export interface AudioUploadResult {
	/** Public URL of the uploaded file */
	url: string;
	/** Storage path of the uploaded file */
	path: string;
	/** Final file that was uploaded (may be converted) */
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
 * Uploads an audio file to Supabase storage with optional MP3 conversion
 * @param options Upload options
 * @returns Upload result with URL and metadata
 */
export async function uploadAudioFile(options: AudioUploadOptions): Promise<AudioUploadResult> {
	const {
		file: inputFile,
		bucket = "recordings",
		folder = "",
		showProgress = true,
		autoConvert = true,
		maxSizeMB = 50
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
					description: "Detta säkerställer kompatibilitet med alla enheter"
				});
			}

			const conversionResult = await convertAudioToMp3(inputFile, {
				bitrate: 128,
				showProgress
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

			// Clean up
			URL.revokeObjectURL(audio.src);
		}

		// Get authenticated user
		const { data: { user } } = await supabase.auth.getUser();
		const userFolder = user?.id || "anonymous";

		// Generate file path
		const fileExt = fileToUpload.name.split(".").pop();
		const timestamp = Date.now();
		const folderPath = folder ? `${userFolder}/${folder}` : userFolder;
		const fileName = `${folderPath}/${timestamp}.${fileExt}`;

		if (showProgress) {
			toast.loading("Laddar upp ljudfil...", { id: "audio-upload" });
		}

		// Upload to storage
		const { error: uploadError, data: uploadData } = await supabase.storage
			.from(bucket)
			.upload(fileName, fileToUpload);

		if (uploadError) {
			throw uploadError;
		}

		// Get public URL
		const { data: { publicUrl } } = supabase.storage
			.from(bucket)
			.getPublicUrl(fileName);

		if (showProgress) {
			toast.success("Ljudfil uppladdad!", { id: "audio-upload" });
		}

		return {
			url: publicUrl,
			path: fileName,
			file: fileToUpload,
			duration,
			wasConverted,
			originalFile: originalFileInfo
		};
	} catch (error) {
		if (showProgress) {
			toast.error("Uppladdning misslyckades", {
				id: "audio-upload",
				description: error instanceof Error ? error.message : "Ett okänt fel uppstod"
			});
		}
		throw error;
	}
}

/**
 * Uploads a cover image to Supabase storage
 * @param file The image file to upload
 * @param bucket Storage bucket name
 * @param folder Custom folder within the bucket
 * @returns Public URL of the uploaded image
 */
export async function uploadCoverImage(
	file: File,
	bucket = "recordings",
	folder = "covers"
): Promise<string> {
	// Validate image file
	if (!file.type.startsWith("image/")) {
		throw new Error("Vänligen välj en bildfil");
	}

	// Check file size (5MB limit for images)
	if (file.size > 5 * 1024 * 1024) {
		throw new Error("Bilden är för stor. Maximal storlek är 5MB");
	}

	// Get authenticated user
	const { data: { user } } = await supabase.auth.getUser();
	const userFolder = user?.id || "anonymous";

	// Generate file path
	const fileExt = file.name.split(".").pop();
	const timestamp = Date.now();
	const fileName = `${userFolder}/${folder}/${timestamp}.${fileExt}`;

	// Upload to storage
	const { error: uploadError } = await supabase.storage
		.from(bucket)
		.upload(fileName, file);

	if (uploadError) {
		throw uploadError;
	}

	// Get public URL
	const { data: { publicUrl } } = supabase.storage
		.from(bucket)
		.getPublicUrl(fileName);

	return publicUrl;
}

/**
 * Deletes a file from Supabase storage
 * @param url The public URL of the file to delete
 * @param bucket Storage bucket name
 */
export async function deleteStorageFile(url: string, bucket = "recordings"): Promise<void> {
	if (!url) return;

	// Extract file path from URL
	const urlParts = url.split(`${bucket}/`);
	if (urlParts.length < 2) {
		throw new Error("Invalid storage URL");
	}

	const filePath = urlParts[1];

	// Delete from storage
	const { error } = await supabase.storage
		.from(bucket)
		.remove([filePath]);

	if (error) {
		throw error;
	}
}

/**
 * Gets the duration of an audio file
 * @param file The audio file
 * @returns Duration in seconds
 */
export async function getAudioDuration(file: File): Promise<number> {
	const audio = new Audio();
	const objectUrl = URL.createObjectURL(file);
	audio.src = objectUrl;

	try {
		await new Promise((resolve, reject) => {
			audio.addEventListener("loadedmetadata", resolve);
			audio.addEventListener("error", reject);
			audio.load();
		});

		return Math.floor(audio.duration);
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

/**
 * Formats file size for display
 * @param bytes File size in bytes
 * @returns Formatted string
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 Bytes";
	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
