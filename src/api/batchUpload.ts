/**
 * Batch upload operations
 * Handles multiple file uploads with progress tracking
 */

import { supabase } from "./supabase";
import { uploadAudioFile } from "./upload";
import { getFilenameWithDate } from "./filename";
import { getAudioDuration } from "./audioProcessing";
import type { Recording, RecordingType } from "./supabase/types";

/**
 * Upload item interface for batch uploads
 */
export interface UploadItem {
	id: string;
	file: File;
	title: string;
	author: string;
	type: RecordingType;
	description: string;
	duration: number;
	status: "pending" | "uploading" | "success" | "error";
	error?: string;
	progress: number;
}

/**
 * Upload result for a single item
 */
export interface UploadResult {
	id: string;
	success: boolean;
	error?: string;
	recording?: Recording;
}

/**
 * Batch upload result
 */
export interface BatchUploadResult {
	successCount: number;
	errorCount: number;
	results: UploadResult[];
}

/**
 * Creates an upload item from a file
 */
export async function createUploadItem(file: File): Promise<UploadItem> {
	// Extract title from filename (remove extension)
	const title = file.name.replace(/\.[^/.]+$/, "");

	// Try to get duration
	const duration = await getAudioDuration(file);

	return {
		id: crypto.randomUUID(),
		file,
		title,
		author: "",
		type: "unknown",
		description: "",
		duration: duration || 0,
		status: "pending",
		progress: 0,
	};
}

/**
 * Creates multiple upload items from files
 */
export async function createUploadItems(files: File[]): Promise<UploadItem[]> {
	const audioFiles = files.filter((file) => file.type.startsWith("audio/"));
	const items = await Promise.all(audioFiles.map(createUploadItem));
	return items;
}

/**
 * Uploads a single item from batch
 */
export async function uploadBatchItem(
	item: UploadItem,
	onProgress?: (progress: number) => void
): Promise<UploadResult> {
	try {
		// Get current user
		const { data: { user } } = await supabase.auth.getUser();

		// Report initial progress
		onProgress?.(10);

		// Upload audio file with automatic conversion if needed
		const uploadResult = await uploadAudioFile({
			file: item.file,
			bucket: "recordings",
			folder: `batch/${item.id}`,
			showProgress: false,
			autoConvert: true,
			maxSizeMB: 50,
		});

		// Report upload complete
		onProgress?.(50);

		// Create database record
		const uploadedAt = new Date().toISOString();
		const recordingData = {
			title: item.title.trim() || "Namnlös inspelning",
			author: item.author.trim() || null,
			type: item.type,
			description: item.description.trim() || null,
			duration: uploadResult.duration || item.duration,
			file_url: uploadResult.url,
			file_size: uploadResult.file.size,
			uploaded_filename:
				uploadResult.wasConverted && uploadResult.originalFile
					? getFilenameWithDate(new File([new Blob()], uploadResult.originalFile.name))
					: getFilenameWithDate(uploadResult.file),
			uploaded_at: uploadedAt,
			uploaded_by: user?.id || null,
			edited_at: uploadedAt,
			edited_by: user?.id || null,
		};

		const { data, error: dbError } = await supabase
			.from("recordings")
			.insert(recordingData)
			.select()
			.single();

		if (dbError) throw dbError;

		// Report completion
		onProgress?.(100);

		return {
			id: item.id,
			success: true,
			recording: data,
		};
	} catch (error) {
		console.error("Upload error:", error);
		return {
			id: item.id,
			success: false,
			error: error instanceof Error ? error.message : "Uppladdning misslyckades",
		};
	}
}

/**
 * Processes batch upload of multiple items
 */
export async function processBatchUpload(
	items: UploadItem[],
	onItemProgress?: (itemId: string, progress: number) => void,
	onItemComplete?: (result: UploadResult) => void
): Promise<BatchUploadResult> {
	const results: UploadResult[] = [];
	let successCount = 0;
	let errorCount = 0;

	for (const item of items) {
		// Skip already successful items
		if (item.status === "success") continue;

		const result = await uploadBatchItem(item, (progress) => {
			onItemProgress?.(item.id, progress);
		});

		if (result.success) {
			successCount++;
		} else {
			errorCount++;
		}

		results.push(result);
		onItemComplete?.(result);
	}

	return {
		successCount,
		errorCount,
		results,
	};
}

/**
 * Validates files for batch upload
 */
export function validateBatchFiles(files: File[]): {
	valid: File[];
	invalid: { file: File; reason: string }[];
} {
	const valid: File[] = [];
	const invalid: { file: File; reason: string }[] = [];

	for (const file of files) {
		if (!file.type.startsWith("audio/")) {
			invalid.push({
				file,
				reason: "Inte en ljudfil",
			});
		} else if (file.size > 50 * 1024 * 1024) {
			invalid.push({
				file,
				reason: "Filen är större än 50MB",
			});
		} else {
			valid.push(file);
		}
	}

	return { valid, invalid };
}

/**
 * Filters upload items by status
 */
export function filterItemsByStatus(
	items: UploadItem[],
	status: UploadItem["status"]
): UploadItem[] {
	return items.filter((item) => item.status === status);
}

/**
 * Counts items by status
 */
export function countItemsByStatus(items: UploadItem[]): Record<UploadItem["status"], number> {
	return items.reduce((acc, item) => {
		acc[item.status] = (acc[item.status] || 0) + 1;
		return acc;
	}, {} as Record<UploadItem["status"], number>);
}
