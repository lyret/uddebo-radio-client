import { persisted } from "svelte-persisted-store";

/**
 * Type definition for Programs UI state
 */
export interface ProgramsUIState {
	sortField: "start_time" | "title" | "edited_at";
	sortOrder: "asc" | "desc";
}

/**
 * Type definition for Recordings UI state
 */
export interface RecordingsUIState {
	sortField: "edited_at" | "title" | "author" | "type" | "duration";
	sortOrder: "asc" | "desc";
	filterStatus: "ok" | "not_ok" | "all";
	filterType: string;
}

/**
 * Persisted store for Programs.svelte UI state
 */
export const programsUIState = persisted<ProgramsUIState>("programs-ui-state", {
	sortField: "start_time",
	sortOrder: "asc",
});

/**
 * Persisted store for Recordings.svelte UI state
 */
export const recordingsUIState = persisted<RecordingsUIState>("recordings-ui-state", {
	sortField: "edited_at",
	sortOrder: "desc",
	filterStatus: "ok",
	filterType: "all",
});
