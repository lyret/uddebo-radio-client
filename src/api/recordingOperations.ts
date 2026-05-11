/**
 * Recording operations module
 * Handles all recording-related database operations
 */

import { pb } from "./pb";
import type { Recording, RecordingInsert, RecordingUpdate } from "./pb/types";

/**
 * Updates a recording in the database
 */
export async function updateRecording(
	id: string,
	updates: RecordingUpdate
): Promise<{ data: Recording | null; error: Error | null }> {
	try {
		const updateData = {
			...updates,
			edited_by: pb.authStore.model?.id ?? null,
		};

		const data = await pb.collection("recordings").update(id, updateData);
		return { data, error: null };
	} catch (error) {
		console.error("Error updating recording:", error);
		return {
			data: null,
			error: error instanceof Error ? error : new Error("Failed to update recording"),
		};
	}
}

/**
 * Fetches a single recording from the database
 */
export async function getRecording(
	id: string
): Promise<{ data: Recording | null; error: Error | null }> {
	try {
		const data = await pb.collection("recordings").getOne(id);
		return { data, error: null };
	} catch (error) {
		console.error("Error fetching recording:", error);
		return {
			data: null,
			error: error instanceof Error ? error : new Error("Failed to fetch recording"),
		};
	}
}

/**
 * Deletes a recording from the database
 */
export async function deleteRecording(id: string): Promise<{ error: Error | null }> {
	try {
		await pb.collection("recordings").delete(id);
		return { error: null };
	} catch (error) {
		console.error("Error deleting recording:", error);
		return {
			error: error instanceof Error ? error : new Error("Failed to delete recording"),
		};
	}
}

/**
 * Marks a recording as OK (approved)
 */
export async function markRecordingAsOK(
	id: string
): Promise<{ data: Recording | null; error: Error | null }> {
	try {
		const userId = pb.authStore.model?.id ?? null;
		const now = new Date().toISOString();

		const data = await pb.collection("recordings").update(id, {
			okey_at: now,
			okey_by: userId,
			edited_by: userId,
		});
		return { data, error: null };
	} catch (error) {
		console.error("Error marking recording as OK:", error);
		return {
			data: null,
			error: error instanceof Error ? error : new Error("Failed to mark recording as OK"),
		};
	}
}

/**
 * Marks a recording as not OK (removes approval)
 */
export async function markRecordingAsNotOK(
	id: string
): Promise<{ data: Recording | null; error: Error | null }> {
	try {
		const userId = pb.authStore.model?.id ?? null;

		const data = await pb.collection("recordings").update(id, {
			okey_at: "",
			okey_by: "",
			edited_by: userId,
		});
		return { data, error: null };
	} catch (error) {
		console.error("Error marking recording as not OK:", error);
		return {
			data: null,
			error: error instanceof Error ? error : new Error("Failed to mark recording as not OK"),
		};
	}
}

/**
 * Deletes the cover image of a recording
 */
export async function deleteRecordingCover(recording: Recording): Promise<{ error: Error | null }> {
	try {
		if (!recording.cover) return { error: null };

		const formData = new FormData();
		formData.append("cover", "");
		await pb.collection("recordings").update(recording.id, formData);
		return { error: null };
	} catch (error) {
		console.error("Error deleting cover image:", error);
		return {
			error: error instanceof Error ? error : new Error("Failed to delete cover image"),
		};
	}
}

/**
 * Deletes the captions file of a recording
 */
export async function deleteRecordingCaptions(
	recording: Recording
): Promise<{ error: Error | null }> {
	try {
		if (!recording.captions) return { error: null };

		const formData = new FormData();
		formData.append("captions", "");
		await pb.collection("recordings").update(recording.id, formData);
		return { error: null };
	} catch (error) {
		console.error("Error deleting captions file:", error);
		return {
			error: error instanceof Error ? error : new Error("Failed to delete captions file"),
		};
	}
}

/**
 * Creates a new recording in the database
 */
export async function createRecording(
	recordingData: RecordingInsert
): Promise<{ data: Recording | null; error: Error | null }> {
	try {
		const data = await pb.collection("recordings").create(recordingData);
		return { data, error: null };
	} catch (error) {
		console.error("Error creating recording:", error);
		return {
			data: null,
			error: error instanceof Error ? error : new Error("Failed to create recording"),
		};
	}
}

/**
 * Batch creates multiple recordings
 */
export async function createRecordings(
	recordings: RecordingInsert[]
): Promise<{ data: Recording[] | null; error: Error | null }> {
	try {
		const data = await Promise.all(
			recordings.map((r) => pb.collection("recordings").create(r))
		);
		return { data, error: null };
	} catch (error) {
		console.error("Error creating recordings:", error);
		return {
			data: null,
			error: error instanceof Error ? error : new Error("Failed to create recordings"),
		};
	}
}
