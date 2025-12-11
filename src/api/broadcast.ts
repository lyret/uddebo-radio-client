import type { Readable } from "svelte/store";
import type { BroadcastProgram } from "./supabase/types";
import Emittery from "emittery";
import { readable, derived, writable, get } from "svelte/store";
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
 * Currently playing medium with playback position
 */
interface CurrentlyPlaying {
	recording: PlayableRecording;
	currentPosition: number; // Current position in seconds
	isWhiteNoise: boolean;
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

const _eventEmitter = new Emittery<{
	recordingStart: PlayableRecording;
	recordingEnd: PlayableRecording;
	finishedPlaying: void;
}>();

/**
 * Store to track whether audio is currently playing
 */
export const isPlaying = writable(false);

/**
 * White noise placeholder recording
 */
const whiteNoiseRecording: PlayableRecording = {
	id: "white-noise",
	title: "Inget spelar",
	author: undefined,
	duration: 60, // 1 minute loop
	audioUrl: "/white-noise.mp3",
	coverUrl: undefined,
	startTime: new Date(0),
	endTime: new Date(0),
};

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
 * Notify that the current audio has finished playing
 * This should be called when the audio element's "ended" event fires
 */
export function notifyTrackFinished(): void {
	console.log("[Broadcast] Track finished playing");
	_eventEmitter.emit("finishedPlaying", undefined);
}

/**
 * Create a store that keeps the currently playing medium with playback position
 */
function createCurrentlyPlayingMedium(): Readable<CurrentlyPlaying> {
	return readable<CurrentlyPlaying>(
		{
			recording: whiteNoiseRecording,
			currentPosition: 0,
			isWhiteNoise: true,
		},
		(set) => {
			let currentlyPlayingRecording: PlayableRecording | null = null;
			let unsubscribeCurrentRecording: (() => void) | null = null;
			let unsubscribeEffectiveDateTime: (() => void) | null = null;
			let unsubscribeIsPlaying: (() => void) | null = null;
			let whiteNoiseCheckInterval: NodeJS.Timeout | null = null;

			// Helper function to calculate position for a recording
			const calculatePosition = (
				recording: PlayableRecording | null,
				effectiveTime: Date
			): number => {
				if (!recording || recording.id === "white-noise") {
					// For white noise, use modulo to create a looping position
					return (effectiveTime.getTime() / 1000) % whiteNoiseRecording.duration;
				}

				// Calculate how far into the recording we should be
				const timeSinceStart = effectiveTime.getTime() - recording.startTime.getTime();
				return Math.max(0, Math.min(timeSinceStart / 1000, recording.duration));
			};

			// Helper function to update the current playing state
			const updateCurrentPlaying = (shouldCheckNext: boolean = false) => {
				const effectiveTime = get(effectiveDateTime);
				const playing = get(isPlaying);
				const schedule = get(broadcastScheduleStore);

				// If we should check for the next track and we're playing
				if (shouldCheckNext && playing && schedule.recordings.length > 0) {
					// Find the next recording after the current one
					if (currentlyPlayingRecording && currentlyPlayingRecording.id !== "white-noise") {
						const currentIndex = schedule.recordings.findIndex(
							(r) => r.id === currentlyPlayingRecording!.id
						);
						if (currentIndex !== -1 && currentIndex < schedule.recordings.length - 1) {
							// Move to the next recording in the schedule
							const nextRec = schedule.recordings[currentIndex + 1];

							// Emit events
							if (currentlyPlayingRecording) {
								_eventEmitter.emit("recordingEnd", currentlyPlayingRecording);
							}
							_eventEmitter.emit("recordingStart", nextRec);

							currentlyPlayingRecording = nextRec;
							set({
								recording: nextRec,
								currentPosition: 0, // Start from the beginning
								isWhiteNoise: false,
							});
							console.log("[CurrentlyPlaying] Moved to next track:", nextRec.title);
							return;
						}
					}
				}

				// Normal update based on current time
				const scheduledRecording = get(currentRecording);

				// Check if we need to change recording
				const isCurrentlyWhiteNoise =
					currentlyPlayingRecording === null || currentlyPlayingRecording.id === "white-noise";

				if (currentlyPlayingRecording?.id !== scheduledRecording?.id) {
					// Emit end event for previous recording
					if (currentlyPlayingRecording && currentlyPlayingRecording.id !== "white-noise") {
						_eventEmitter.emit("recordingEnd", currentlyPlayingRecording);
					}

					// Update to new recording
					if (scheduledRecording) {
						_eventEmitter.emit("recordingStart", scheduledRecording);
						currentlyPlayingRecording = scheduledRecording;

						const position = calculatePosition(scheduledRecording, effectiveTime);
						set({
							recording: scheduledRecording,
							currentPosition: position,
							isWhiteNoise: false,
						});
						console.log(
							"[CurrentlyPlaying] Changed to scheduled track:",
							scheduledRecording.title,
							"at position:",
							position
						);

						// If we're transitioning from white noise to a scheduled track while playing,
						// we need to handle this specially (white noise never triggers finishedPlaying)
						if (isCurrentlyWhiteNoise && playing) {
							console.log("[CurrentlyPlaying] Transitioning from white noise to scheduled track");
							// Clear the white noise check interval
							if (whiteNoiseCheckInterval) {
								clearInterval(whiteNoiseCheckInterval);
								whiteNoiseCheckInterval = null;
							}
						}
					} else {
						// No recording scheduled - use white noise
						currentlyPlayingRecording = null;
						const position = calculatePosition(null, effectiveTime);
						set({
							recording: whiteNoiseRecording,
							currentPosition: position,
							isWhiteNoise: true,
						});
						console.log("[CurrentlyPlaying] No track scheduled, using white noise");

						// Start periodic checking for scheduled tracks when playing white noise
						if (playing && !whiteNoiseCheckInterval) {
							console.log("[CurrentlyPlaying] Starting white noise check interval");
							whiteNoiseCheckInterval = setInterval(() => {
								const scheduled = get(currentRecording);
								if (scheduled) {
									console.log(
										"[CurrentlyPlaying] Scheduled track became available during white noise"
									);
									updateCurrentPlaying(false);
								}
							}, 1000); // Check every second
						}
					}
				} else {
					// Same recording, just update position
					const position = calculatePosition(currentlyPlayingRecording || null, effectiveTime);

					if (currentlyPlayingRecording) {
						set({
							recording: currentlyPlayingRecording,
							currentPosition: position,
							isWhiteNoise: false,
						});
					} else {
						set({
							recording: whiteNoiseRecording,
							currentPosition: position,
							isWhiteNoise: true,
						});
					}
				}
			};

			// Listen for track finished events
			const handleTrackFinished = () => {
				console.log("[CurrentlyPlaying] Handling track finished event");
				updateCurrentPlaying(true);
			};
			_eventEmitter.on("finishedPlaying", handleTrackFinished);

			// Subscribe to stores
			unsubscribeCurrentRecording = currentRecording.subscribe(() => {
				const playing = get(isPlaying);
				const isCurrentlyWhiteNoise =
					currentlyPlayingRecording === null || currentlyPlayingRecording.id === "white-noise";

				if (!playing || isCurrentlyWhiteNoise) {
					// If not playing, or if we're playing white noise, check for scheduled tracks
					updateCurrentPlaying(false);
				}
				// If playing a regular track, we wait for the finishedPlaying event
			});

			unsubscribeEffectiveDateTime = effectiveDateTime.subscribe(() => {
				// Update position but don't change tracks while playing
				if (!get(isPlaying)) {
					updateCurrentPlaying(false);
				}
			});

			unsubscribeIsPlaying = isPlaying.subscribe((playing) => {
				if (playing) {
					// When starting to play, update to current track
					updateCurrentPlaying(false);
				}
			});

			// Initial update
			updateCurrentPlaying(false);

			// Cleanup
			return () => {
				_eventEmitter.off("finishedPlaying", handleTrackFinished);
				if (unsubscribeCurrentRecording) unsubscribeCurrentRecording();
				if (unsubscribeEffectiveDateTime) unsubscribeEffectiveDateTime();
				if (unsubscribeIsPlaying) unsubscribeIsPlaying();
				if (whiteNoiseCheckInterval) {
					clearInterval(whiteNoiseCheckInterval);
				}
			};
		}
	);
}

/**
 * Returns the currently playing medium with position information
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
