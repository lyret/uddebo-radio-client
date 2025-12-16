/**
 * Recording operations module
 * Handles all recording-related database operations
 */

import { supabase } from "./supabase";
import type { Recording } from "./supabase/types";

/**
 * Updates a recording in the database
 */
export async function updateRecording(
	id: number,
	updates: Partial<Recording>
): Promise<{ data: Recording | null; error: Error | null }> {
	try {
		// Get current user
		const {
			data: { user },
		} = await supabase.auth.getUser();

		// Add edited metadata
		const updateData = {
			...updates,
			edited_at: new Date().toISOString(),
			edited_by: user?.id || null,
		};

		const { data, error } = await supabase
			.from("recordings")
			.update(updateData)
			.eq("id", id)
			.select()
			.single();

		if (error) throw error;
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
	id: number
): Promise<{ data: Recording | null; error: Error | null }> {
	try {
		const { data, error } = await supabase.from("recordings").select("*").eq("id", id).single();

		if (error) throw error;
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
export async function deleteRecording(id: number): Promise<{ error: Error | null }> {
	try {
		const { error } = await supabase.from("recordings").delete().eq("id", id);

		if (error) throw error;
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
	id: number
): Promise<{ data: Recording | null; error: Error | null }> {
	try {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		const now = new Date().toISOString();

		const updateData = {
			okey_at: now,
			okey_by: user?.id || null,
			edited_at: now,
			edited_by: user?.id || null,
		};

		const { data, error } = await supabase
			.from("recordings")
			.update(updateData)
			.eq("id", id)
			.select()
			.single();

		if (error) throw error;
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
	id: number
): Promise<{ data: Recording | null; error: Error | null }> {
	try {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		const now = new Date().toISOString();

		const updateData = {
			okey_at: null,
			okey_by: null,
			edited_at: now,
			edited_by: user?.id || null,
		};

		const { data, error } = await supabase
			.from("recordings")
			.update(updateData)
			.eq("id", id)
			.select()
			.single();

		if (error) throw error;
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
		if (!recording.cover_url) {
			return { error: null };
		}

		// Extract file path from URL
		const url = new URL(recording.cover_url);
		const pathParts = url.pathname.split("/storage/v1/object/public/");
		if (pathParts.length < 2) {
			throw new Error("Invalid cover URL format");
		}

		const filePath = pathParts[1];
		const [bucket, ...filePathParts] = filePath.split("/");
		const actualFilePath = filePathParts.join("/");

		// Delete from storage
		const { error: storageError } = await supabase.storage.from(bucket).remove([actualFilePath]);

		if (storageError) throw storageError;

		// Update database
		const { error: dbError } = await updateRecording(recording.id, {
			cover_url: null,
		});

		if (dbError) throw dbError;
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
		if (!recording.captions_url) {
			return { error: null };
		}

		// Extract file path from URL
		const url = new URL(recording.captions_url);
		const pathParts = url.pathname.split("/storage/v1/object/public/");
		if (pathParts.length < 2) {
			throw new Error("Invalid captions URL format");
		}

		const filePath = pathParts[1];
		const [bucket, ...filePathParts] = filePath.split("/");
		const actualFilePath = filePathParts.join("/");

		// Delete from storage
		const { error: storageError } = await supabase.storage.from(bucket).remove([actualFilePath]);

		if (storageError) throw storageError;

		// Update database
		const { error: dbError } = await updateRecording(recording.id, {
			captions_url: null,
		});

		if (dbError) throw dbError;
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
	recordingData: Omit<Recording, "id" | "created_at">
): Promise<{ data: Recording | null; error: Error | null }> {
	try {
		const { data, error } = await supabase
			.from("recordings")
			.insert(recordingData)
			.select()
			.single();

		if (error) throw error;
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
	recordings: Omit<Recording, "id" | "created_at">[]
): Promise<{ data: Recording[] | null; error: Error | null }> {
	try {
		const { data, error } = await supabase.from("recordings").insert(recordings).select();

		if (error) throw error;
		return { data, error: null };
	} catch (error) {
		console.error("Error creating recordings:", error);
		return {
			data: null,
			error: error instanceof Error ? error : new Error("Failed to create recordings"),
		};
	}
}
