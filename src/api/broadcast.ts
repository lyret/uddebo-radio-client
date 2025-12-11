import type { Readable } from "svelte/store";
import type { BroadcastProgram } from "./supabase/types";
import Emittery from "emittery";
import { readable, derived } from "svelte/store";
import { effectiveDateTime } from "./datetime";
import { supabase } from "./supabase";

/**
 * Recording item with scheduling information
 */
interface PlayableRecording {
	id: string;
	title: string;
	author?: string;
	duration: number;
	audioUrl: string;
	coverUrl?: string;
	startTime: Date;
	endTime: Date;
}

/**
 * Broadcast schedule state without currentRecordingIndex
 */
interface PlayableBroadcast {
	program: BroadcastProgram | null;
	startTime: Date | null;
	endTime: Date | null;
	recordings: PlayableRecording[];
	loading: boolean;
	error: string | null;
}

export const _eventEmitter = new Emittery<{
	recordingStart: PlayableRecording;
	recordingEnd: PlayableRecording;
}>();

/**
 * Create the broadcast schedule store that subscribes to datetime and fetches active programs
 */
function createBroadcastScheduleStore(): Readable<PlayableBroadcast> {
	return readable<PlayableBroadcast>(
		{
			program: null,
			startTime: null,
			endTime: null,
			recordings: [],
			loading: true,
			error: null,
		},
		(set) => {
			let cancelled = false;

			// Fetch program data once
			(async () => {
				try {
					const { data, error } = await supabase
						.from("broadcast_programs")
						.select("*")
						.eq("is_active", true)
						.order("created_at", { ascending: false })
						.limit(1)
						.single();

					if (cancelled) {
						return;
					} else if (error) {
						throw error;
					} else if (!data) {
						throw new Error("No active broadcast program found");
					} else {
						// Parse start time
						const startTime = data.start_time ? new Date(data.start_time) : new Date();

						// Parse recordings with calculated dates
						const { recordings, endTime } = await _parseRecordings(
							data.recordings as Array<string>,
							startTime
						);

						const successState = {
							program: data,
							startTime: startTime,
							endTime: endTime,
							recordings,
							loading: false,
							error: null,
						};
						set(successState);
						console.log("[BroadcastSchedule] Program loaded successfully:", {
							title: data.title,
							recordingCount: recordings.length,
							programDuration:
								successState.endTime && successState.startTime
									? `${Math.round((successState.endTime.getTime() - successState.startTime.getTime()) / 1000 / 60)} minutes`
									: "Unknown",
						});
					}
				} catch (err) {
					const errorMessage = err instanceof Error ? err.message : "Unknown error";
					const errorState = {
						program: null,
						startTime: null,
						endTime: null,
						recordings: [],
						loading: false,
						error: errorMessage,
					};
					set(errorState);
					console.error("[BroadcastSchedule] Error getting program:", errorMessage);
				}
			})();

			// Cleanup
			return () => {
				cancelled = true;
			};
		}
	);
}

/**
 * The broadcast schedule store instance.
 * Maintains a list of scheduled recordings from the active broadcast program in Supabase.
 */
export const broadcastScheduleStore = createBroadcastScheduleStore();

/**
 * Derived store for the current recording based on effective datetime
 */
export const currentRecording = derived(
	[broadcastScheduleStore, effectiveDateTime],
	([$schedule, $effectiveDateTime]) => {
		if ($schedule.loading || $schedule.error || !$schedule.recordings.length) {
			return null;
		}
		return _findRecordingAtTime($schedule.recordings, $effectiveDateTime);
	}
);

/**
 * Derived store for the next recording based on effective datetime
 */
export const nextRecording = derived(
	[broadcastScheduleStore, effectiveDateTime],
	([$schedule, $effectiveDateTime]) => {
		if ($schedule.loading || $schedule.error || !$schedule.recordings.length) {
			return null;
		}

		// Find the first recording that starts after the effective datetime
		for (const recording of $schedule.recordings) {
			if (recording.startTime > $effectiveDateTime) {
				return recording;
			}
		}

		return null;
	}
);

/**
 * Create a store that keeps the currently playing recording or a placeholder if nothing is broadcasted
 */
function createCurrentlyPlayingMedium(): Readable<PlayableRecording> {
	let _previousRecording: PlayableRecording | null = null;
	return derived([currentRecording], ([$currentRecording], set) => {
		// Recording ended
		if (
			_previousRecording &&
			(!$currentRecording || _previousRecording.id !== $currentRecording.id)
		) {
			_eventEmitter.emit("recordingEnd", _previousRecording);
		}
		// Recording started
		if (
			$currentRecording &&
			(!_previousRecording || _previousRecording.id !== $currentRecording.id)
		) {
			_eventEmitter.emit("recordingStart", $currentRecording);
			set($currentRecording);
		} else if (!_previousRecording && !$currentRecording) {
			set({
				id: "",
				title: "Inget spelar",
				startTime: null as any,
				endTime: null as any,
				audioUrl: "/white-noise.mp3",
				duration: 0,
			});
		}
		_previousRecording = $currentRecording;
	});
}
/**
 * Returns the currently playing medium
 */
export const currentlyPlayingMedium = createCurrentlyPlayingMedium();

/**
 * Parse and validate recording data from JSON
 */
async function _parseRecordings(
	recordingsIds: Array<string>,
	startTime: Date
): Promise<{ endTime: Date; recordings: Array<PlayableRecording> }> {
	try {
		if (!Array.isArray(recordingsIds)) {
			throw new Error("Invalid recordings data");
		}

		// Extract unique IDs from the array
		const uniqueIds = [...new Set(recordingsIds.map((id) => String(id)))];

		// Fetch recording data from Supabase
		const { data: recordingsData, error } = await supabase
			.from("recordings")
			.select("*")
			.in("id", uniqueIds);
		if (error) {
			throw new Error(`Failed to fetch recordings: ${error.message}`);
		}
		if (!recordingsData || recordingsData.length === 0) {
			throw new Error("No recordings found for the provided IDs");
		}
		const recordingsRecord = new Map(recordingsData.map((rec) => [String(rec.id), rec]));
		const parsedRecordings: PlayableRecording[] = [];
		let indexTime = new Date(startTime);

		for (const index in recordingsIds) {
			const id = recordingsIds[index];
			const recording = recordingsRecord.get(String(id));
			if (recording) {
				const startTime = new Date(indexTime);
				const endTime = new Date(indexTime.getTime() + (recording.duration || 0) * 1000 + 1000);

				parsedRecordings.push({
					id: `${String(recording.id)}_${index}`, // Add the order number to the unique for repetitions
					title: recording.title || "",
					author: recording.author || "",
					duration: Number(recording.duration) || 0,
					audioUrl: String(recording.file_url || ""),
					coverUrl: recording.cover_url || "",
					startTime,
					endTime,
				});

				indexTime = endTime;
			}
		}
		return { recordings: parsedRecordings, endTime: indexTime };
	} catch (error) {
		console.error("Error parsing recordings:", error);
		return { recordings: [], endTime: startTime };
	}
}

/**
 * Find a recording for the given time
 */
function _findRecordingAtTime(
	recordings: PlayableRecording[],
	time: Date
): PlayableRecording | null {
	for (const recording of recordings) {
		if (time >= recording.startTime && time < recording.endTime) {
			return recording;
		}
	}
	return null;
}
