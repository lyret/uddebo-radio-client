import { writable, derived } from "svelte/store";

/**
 * Interface for datetime store state
 */
interface DateTimeState {
	currentDateTime: Date;
	effectiveDateTime: Date;
	timeOffset: number;
	debugDateTimeInput: string;
}

/**
 * Format date for datetime-local input
 */
function formatDateTimeLocal(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Create the datetime store with automatic time progression.
 * This store manages both real time and an effective time that can be offset
 * for testing purposes. The effective time progresses normally from its initial value.
 */
function createDateTimeStore() {
	const { subscribe, set, update } = writable<DateTimeState>({
		currentDateTime: new Date(),
		effectiveDateTime: new Date(),
		timeOffset: 0,
		debugDateTimeInput: formatDateTimeLocal(new Date()),
	});

	let interval: ReturnType<typeof setInterval> | null = null;
	let subscriberCount = 0;

	return {
		subscribe(run: (value: DateTimeState) => void) {
			subscriberCount++;

			// Initialize the store when first subscriber connects
			if (!interval) {
				const searchParams = new URLSearchParams(window.location.search);
				const dateTimeParam = searchParams.get("datetime");
				const mountTime = new Date();

				// Set initial state
				let initialOffset = 0;
				let initialDebugInput = formatDateTimeLocal(mountTime);

				if (dateTimeParam) {
					const parsedDate = new Date(dateTimeParam);
					if (!isNaN(parsedDate.getTime())) {
						initialOffset = parsedDate.getTime() - mountTime.getTime();
						initialDebugInput = formatDateTimeLocal(parsedDate);
					}
				}

				set({
					currentDateTime: mountTime,
					effectiveDateTime: new Date(mountTime.getTime() + initialOffset),
					timeOffset: initialOffset,
					debugDateTimeInput: initialDebugInput,
				});

				// Update times every second
				interval = setInterval(() => {
					update((state) => {
						const now = new Date();
						return {
							...state,
							currentDateTime: now,
							effectiveDateTime: new Date(now.getTime() + state.timeOffset),
						};
					});
				}, 1000);
			}

			// Subscribe to store
			const unsubscribe = subscribe(run);

			// Return cleanup function
			return () => {
				unsubscribe();
				subscriberCount--;

				// Clear interval if no more subscribers
				if (interval && subscriberCount === 0) {
					clearInterval(interval);
					interval = null;
				}
			};
		},

		/**
		 * Set a new datetime and update URL parameter.
		 * The effective datetime will progress normally from this new point.
		 * @param dateTimeInput - The datetime string from the input field
		 */
		setDateTime(dateTimeInput: string) {
			const url = new URL(window.location.href);
			if (dateTimeInput) {
				const inputDate = new Date(dateTimeInput);
				if (!isNaN(inputDate.getTime())) {
					url.searchParams.set("datetime", inputDate.toISOString());
					const newOffset = inputDate.getTime() - new Date().getTime();

					update((state) => ({
						...state,
						timeOffset: newOffset,
						effectiveDateTime: inputDate,
						debugDateTimeInput: dateTimeInput,
					}));
				}
			}
			window.history.replaceState({}, "", url.toString());
		},

		/**
		 * Clear datetime parameter and reset to use current time.
		 * Removes any time offset and syncs effective time with real time.
		 */
		useCurrentTime() {
			const url = new URL(window.location.href);
			url.searchParams.delete("datetime");
			window.history.replaceState({}, "", url.toString());

			update((state) => ({
				...state,
				timeOffset: 0,
				effectiveDateTime: state.currentDateTime,
				debugDateTimeInput: formatDateTimeLocal(state.currentDateTime),
			}));
		},

		/**
		 * Update the debug input value without actually setting the datetime.
		 * Used for controlled input fields to update the display value.
		 * @param value - The new datetime input value
		 */
		updateDebugInput(value: string) {
			update((state) => ({
				...state,
				debugDateTimeInput: value,
			}));
		},
	};
}

/**
 * The main datetime store instance.
 * Provides methods to manage effective datetime for testing scheduled content.
 * The store automatically initializes from URL parameters and maintains time progression.
 */
export const dateTimeStore = createDateTimeStore();

/**
 * Derived store for just the effective datetime.
 * Use this in components that need to react to the current effective time.
 */
export const effectiveDateTime = derived(dateTimeStore, ($dateTime) => $dateTime.effectiveDateTime);

/**
 * Derived store for the time offset in minutes.
 * Positive values mean effective time is ahead of real time,
 * negative values mean it's behind.
 */
export const timeOffsetMinutes = derived(dateTimeStore, ($dateTime) =>
	Math.round($dateTime.timeOffset / 1000 / 60)
);
