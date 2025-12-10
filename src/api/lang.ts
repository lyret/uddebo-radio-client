import type { RecordingType } from "./supabase/types";

/**
 * Swedish translations for RecordingType enum values
 */
const recordingTypeToSwedish: Record<RecordingType, string> = {
	unknown: "Okänd",
	jingle: "Jingel",
	poetry: "Poesi",
	music: "Musik",
	news: "Nyheter",
	commentary: "Kommentar",
	talk: "Tal",
	comedy: "Komedi",
	talkshow: "Pratshow",
	interview: "Intervju",
	other: "Övrigt"
};

/**
 * Reverse mapping from Swedish to RecordingType enum values
 */
const swedishToRecordingType: Record<string, RecordingType> = {
	"Okänd": "unknown",
	"Jingel": "jingle",
	"Poesi": "poetry",
	"Musik": "music",
	"Nyheter": "news",
	"Kommentar": "commentary",
	"Tal": "talk",
	"Komedi": "comedy",
	"Pratshow": "talkshow",
	"Intervju": "interview",
	"Övrigt": "other"
};

/**
 * Convert a RecordingType enum value to its Swedish translation
 * @param type - The RecordingType enum value to translate
 * @returns The Swedish translation of the recording type
 */
export function getSwedishRecordingType(type: RecordingType): string {
	return recordingTypeToSwedish[type];
}

/**
 * Convert a Swedish recording type string to its RecordingType enum value
 * @param swedish - The Swedish recording type string
 * @returns The corresponding RecordingType enum value, or "unknown" if not found
 */
export function getRecordingTypeFromSwedish(swedish: string): RecordingType {
	return swedishToRecordingType[swedish] || "unknown";
}

/**
 * Get all available Swedish recording type options
 * @returns Array of objects with enum value and Swedish translation
 */
export function getAllSwedishRecordingTypes(): Array<{ value: RecordingType; label: string }> {
	return Object.entries(recordingTypeToSwedish).map(([value, label]) => ({
		value: value as RecordingType,
		label
	}));
}
