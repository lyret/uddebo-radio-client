/**
 * File upload utilities
 * Handles file validation and upload operations for captions and other files
 */

import { pb } from "./pb";
import type { Recording } from "./pb/types";

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
 * Uploads a captions file and attaches it to a recording record
 */
export async function uploadCaptionsFile(
	file: File,
	recordingId: string
): Promise<{ data: Recording | null; error: Error | null }> {
	try {
		const validation = validateCaptionFile(file);
		if (!validation.valid) {
			throw new Error(validation.error);
		}

		const formData = new FormData();
		formData.append("captions", file);

		const data = await pb.collection("recordings").update(recordingId, formData);
		return { data, error: null };
	} catch (error) {
		console.error("Error uploading captions file:", error);
		return {
			data: null,
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
