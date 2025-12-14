/**
 * Utility functions for handling filenames with metadata
 */

/**
 * Format a date as YYYY-MM-DD string
 * @param date - The date to format
 * @returns Formatted date string
 */
function formatDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * Generate a filename with the file's lastModified date prepended
 * @param file - The file object with name and lastModified properties
 * @returns Filename with date prefix in format "YYYY-MM-DD_originalname.ext"
 */
export function getFilenameWithDate(file: File): string {
	const lastModified = new Date(file.lastModified);
	const dateString = formatDateString(lastModified);
	return `${dateString}_${file.name}`;
}

/**
 * Extract the original filename from a date-prefixed filename
 * @param filenameWithDate - Filename that may have a date prefix
 * @returns The original filename without date prefix, or the input if no prefix found
 */
export function getOriginalFilename(filenameWithDate: string): string {
	// Match pattern YYYY-MM-DD_ at the start of the filename
	const datePattern = /^\d{4}-\d{2}-\d{2}_/;
	if (datePattern.test(filenameWithDate)) {
		return filenameWithDate.replace(datePattern, "");
	}
	return filenameWithDate;
}

/**
 * Extract the date from a date-prefixed filename
 * @param filenameWithDate - Filename that may have a date prefix
 * @returns The date if found, or null if no valid date prefix
 */
export function getDateFromFilename(filenameWithDate: string): Date | null {
	// Match pattern YYYY-MM-DD at the start of the filename
	const match = filenameWithDate.match(/^(\d{4})-(\d{2})-(\d{2})_/);
	if (match) {
		const [, year, month, day] = match;
		return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
	}
	return null;
}
