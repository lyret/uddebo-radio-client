/**
 * Document title manager for updating browser tab titles
 */

let originalTitle: string | null = null;
let intervalId: number | null = null;

/**
 * Store the original document title
 */
export function storeOriginalTitle(): void {
	if (originalTitle === null) {
		originalTitle = document.title;
	}
}

/**
 * Update the document title
 */
export function updateDocumentTitle(title: string): void {
	storeOriginalTitle();
	document.title = title;
}

/**
 * Restore the original document title
 */
export function restoreDocumentTitle(): void {
	if (originalTitle !== null) {
		document.title = originalTitle;
	}
	if (intervalId !== null) {
		clearInterval(intervalId);
		intervalId = null;
	}
}
