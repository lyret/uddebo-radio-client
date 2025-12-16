/**
 * Audio normalization workflow
 * Handles the complete normalization process including conversion and upload
 */

import { toast } from "svelte-sonner";
import { convertAudioToMp3FromBlob } from "./audioConverter";
import { uploadAudioFile } from "./upload";
import { updateRecording } from "./recordingOperations";
import { normalizeAndEncode } from "./audioProcessing";
import type { NormalizationOptions } from "./audioProcessing";

/**
 * Extended options for normalization with preview support
 */
export interface NormalizationWithPreviewOptions extends NormalizationOptions {
	previewBlob?: Blob;
}

/**
 * Complete audio normalization workflow
 * Handles normalization, conversion, upload, and database update
 */
export async function normalizeRecordingAudio(
	recording: { id: string; file_url: string },
	options: NormalizationWithPreviewOptions
): Promise<{ data: any; error: any }> {
	const {
		gainDb,
		useCompression,
		useLeveling,
		compressionRatio,
		showProgress = true,
		previewBlob,
	} = options;

	try {
		if (showProgress) {
			let statusMessage = "Normaliserar ljudfil";
			if (useLeveling) statusMessage = "Jämnar ut ljudnivåer";
			if (useCompression) statusMessage = "Komprimerar och normaliserar ljudfil";
			toast.info(statusMessage + "...");
		}

		let finalBlob: Blob;
		let finalFileName: string;

		// Use preview blob if provided, otherwise process the audio
		if (previewBlob) {
			// Preview blob is already processed, just need to convert if necessary
			finalBlob = previewBlob;
			finalFileName = `${recording.id}_normalized.wav`;

			// Check if it's WAV and needs MP3 conversion
			if (previewBlob.type === "audio/wav") {
				const mp3Blob = await convertAudioToMp3FromBlob(previewBlob);
				finalBlob = mp3Blob;
				finalFileName = `${recording.id}_normalized.mp3`;
			}
		} else {
			// Process the audio from scratch
			const { blob: normalizedBlob, format } = await normalizeAndEncode(
				recording.file_url,
				gainDb,
				{
					useCompression,
					useLeveling,
					compressionRatio: compressionRatio || 4,
					compressionThreshold: options.compressionThreshold || -24,
					levelingTarget: options.levelingTarget || -16,
				}
			);

			finalBlob = normalizedBlob;
			finalFileName = `${recording.id}_normalized.wav`;

			if (format === "wav") {
				const mp3Blob = await convertAudioToMp3FromBlob(normalizedBlob);
				finalBlob = mp3Blob;
				finalFileName = `${recording.id}_normalized.mp3`;
			}
		}

		// Create File object
		const normalizedFile = new File([finalBlob], finalFileName, {
			type: finalBlob.type,
		});

		// Upload the normalized audio
		const uploadResult = await uploadAudioFile({
			file: normalizedFile,
			bucket: "recordings",
			folder: "",
			showProgress: showProgress,
			autoConvert: false, // Already converted
			maxSizeMB: 50,
		});

		// Update the recording with new audio URL
		const { data, error } = await updateRecording(recording.id, {
			file_url: uploadResult.url,
			file_size: uploadResult.file.size,
			duration: uploadResult.duration,
		});

		if (error) throw error;

		if (showProgress && data) {
			let successMessage = `Ljudvolym normaliserad`;
			if (useLeveling) {
				successMessage = "Ljudnivåer utjämnade";
			} else if (useCompression) {
				successMessage = `Ljudfil komprimerad (${compressionRatio}:1 ratio)`;
			} else if (gainDb !== 0) {
				successMessage += ` (${gainDb > 0 ? "+" : ""}${gainDb} dB)`;
			}
			toast.success(successMessage);
		}

		return { data, error: null };
	} catch (error) {
		if (showProgress) {
			toast.error("Kunde inte normalisera ljudvolym");
		}
		console.error("Volume normalization error:", error);
		return { data: null, error };
	}
}
