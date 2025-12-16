/**
 * File upload utilities
 * Handles file validation and upload operations for captions and other files
 */

import { supabase } from "./supabase";
import { getFilenameWithDate } from "./filename";

/**
 * Valid caption file types
 */
export const VALID_CAPTION_TYPES = [".vtt", ".srt", ".txt", ".json"];

/**
 * Valid image file types
 */
export const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/**
 * Maximum file sizes in MB
 */
export const MAX_FILE_SIZES = {
	audio: 50,
	image: 5,
	captions: 1,
};

/**
 * Validates a caption file
 */
export function validateCaptionFile(file: File): { valid: boolean; error?: string } {
	const fileExt = `.${file.name.split(".").pop()?.toLowerCase()}`;

	if (!VALID_CAPTION_TYPES.includes(fileExt)) {
		return {
			valid: false,
			error: `Ogiltig filtyp. Vänligen välj en fil av typen: ${VALID_CAPTION_TYPES.join(", ")}`,
		};
	}

	if (file.size > MAX_FILE_SIZES.captions * 1024 * 1024) {
		return {
			valid: false,
			error: `Filen är för stor. Max storlek: ${MAX_FILE_SIZES.captions}MB`,
		};
	}

	return { valid: true };
}

/**
 * Validates an image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
	if (!VALID_IMAGE_TYPES.includes(file.type)) {
		return {
			valid: false,
			error: "Ogiltig filtyp. Vänligen välj en bildfil (jpg, png, etc.)",
		};
	}

	if (file.size > MAX_FILE_SIZES.image * 1024 * 1024) {
		return {
			valid: false,
			error: `Bilden är för stor. Max storlek: ${MAX_FILE_SIZES.image}MB`,
		};
	}

	return { valid: true };
}

/**
 * Uploads a captions file to Supabase storage
 */
export async function uploadCaptionsFile(
	file: File,
	recordingId: number
): Promise<{ url: string | null; error: Error | null }> {
	try {
		// Validate file
		const validation = validateCaptionFile(file);
		if (!validation.valid) {
			throw new Error(validation.error);
		}

		const fileExt = `.${file.name.split(".").pop()}`;
		const timestamp = Date.now();
		const fileName = `${recordingId}_${timestamp}${fileExt}`;

		// Upload to storage
		const { error: uploadError } = await supabase.storage.from("captions").upload(fileName, file, {
			contentType: file.type || "text/plain",
		});

		if (uploadError) throw uploadError;

		// Get public URL
		const { data: urlData } = supabase.storage.from("captions").getPublicUrl(fileName);

		return { url: urlData.publicUrl, error: null };
	} catch (error) {
		console.error("Error uploading captions file:", error);
		return {
			url: null,
			error: error instanceof Error ? error : new Error("Failed to upload captions file"),
		};
	}
}

// deleteStorageFile is exported from upload.ts

/**
 * Gets file metadata from a File object
 */
export interface FileMetadata {
	name: string;
	size: number;
	type: string;
	extension: string;
	sizeInMB: number;
}

/**
 * Extracts metadata from a file
 */
export function getFileMetadata(file: File): FileMetadata {
	const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;

	return {
		name: file.name,
		size: file.size,
		type: file.type,
		extension,
		sizeInMB: file.size / 1024 / 1024,
	};
}

/**
 * Creates a preview URL for a file
 */
export function createFilePreviewUrl(file: File): string {
	return URL.createObjectURL(file);
}

/**
 * Revokes a preview URL to free memory
 */
export function revokeFilePreviewUrl(url: string): void {
	URL.revokeObjectURL(url);
}

// formatFileSize is already exported from upload.ts
