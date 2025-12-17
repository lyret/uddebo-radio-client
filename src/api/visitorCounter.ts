import { supabase } from "./supabase";
import type { Json } from "./supabase/types";

/**
 * Generates a unique visitor ID for the current browser session
 * Uses localStorage to persist across page reloads but maintain privacy
 */
function getVisitorId(): string {
	const storageKey = "uddebo_visitor_id";
	let visitorId = localStorage.getItem(storageKey);

	if (!visitorId) {
		// Generate a random ID that doesn't contain personal info
		visitorId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
		localStorage.setItem(storageKey, visitorId);
	}

	return visitorId;
}

/**
 * Stats returned from the visitor tracking functions
 */
export interface VisitorStats {
	page_path?: string;
	total_visits: number;
	unique_visitors: number;
	today_visits?: number;
	today_unique_visitors?: number;
	pages?: string[];
	period_days?: number;
	daily_stats?: Array<{
		date: string;
		visits: number;
		unique_visitors: number;
	}>;
}

/**
 * Records a visit to a specific page
 * @param pagePath - The path of the page being visited (e.g., "/", "/about", etc.)
 * @param options - Optional metadata about the visit
 * @returns Current stats for the page after recording the visit
 */
export async function recordVisit(
	pagePath: string,
	options?: {
		userAgent?: string;
		referrer?: string;
	}
): Promise<VisitorStats | null> {
	try {
		const visitorId = getVisitorId();

		const { data, error } = await supabase.rpc("record_visit", {
			p_page_path: pagePath,
			p_visitor_id: visitorId,
			p_user_agent: options?.userAgent || navigator.userAgent || null,
			p_referrer: options?.referrer || document.referrer || null,
		});

		if (error) {
			console.error("Error recording visit:", error);
			return null;
		}

		return data as unknown as VisitorStats;
	} catch (err) {
		console.error("Failed to record visit:", err);
		return null;
	}
}

/**
 * Gets visitor statistics for a specific page or all pages
 * @param pagePath - Optional page path to get stats for. If not provided, returns overall stats
 * @param daysBack - Number of days to look back (default: 30)
 * @returns Visitor statistics
 */
export async function getVisitorStats(
	pagePath?: string,
	daysBack: number = 30
): Promise<VisitorStats | null> {
	try {
		const { data, error } = await supabase.rpc("get_visitor_stats", {
			p_page_path: pagePath || null,
			p_days_back: daysBack,
		});

		if (error) {
			console.error("Error getting visitor stats:", error);
			return null;
		}

		return data as unknown as VisitorStats;
	} catch (err) {
		console.error("Failed to get visitor stats:", err);
		return null;
	}
}

/**
 * Gets today's visitor count for a specific page or all pages
 * @param pagePath - Optional page path to get stats for
 * @returns Today's visitor count
 */
export async function getTodayVisitorCount(pagePath?: string): Promise<number> {
	try {
		const query = supabase
			.from("visitor_stats")
			.select("visitor_id", { count: "exact", head: true });

		// Add page filter if specified
		if (pagePath) {
			query.eq("page_path", pagePath);
		}

		// Filter for today's visits
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		query.gte("visited_at", today.toISOString());

		const { count, error } = await query;

		if (error) {
			console.error("Error getting today's visitor count:", error);
			return 0;
		}

		return count || 0;
	} catch (err) {
		console.error("Failed to get today's visitor count:", err);
		return 0;
	}
}

/**
 * Gets unique visitor count for a specific page or all pages
 * @param pagePath - Optional page path to get stats for
 * @param daysBack - Number of days to look back (default: 30)
 * @returns Unique visitor count
 */
export async function getUniqueVisitorCount(
	pagePath?: string,
	daysBack: number = 30
): Promise<number> {
	try {
		const stats = await getVisitorStats(pagePath, daysBack);
		return stats?.unique_visitors || 0;
	} catch (err) {
		console.error("Failed to get unique visitor count:", err);
		return 0;
	}
}

/**
 * Tracks a page visit automatically when called
 * Should be called once per page/route load
 * @param pagePath - The current page path (defaults to current location)
 */
export async function trackPageVisit(pagePath?: string): Promise<VisitorStats | null> {
	const path = pagePath || window.location.pathname;
	return recordVisit(path);
}

/**
 * Hook to automatically track page visits in Svelte components
 * Usage: Call this in onMount() of your page components
 * @returns Function to track the current page
 */
export function createVisitorTracker() {
	return async (pagePath?: string) => {
		// Small delay to ensure page is fully loaded
		await new Promise((resolve) => setTimeout(resolve, 100));
		return trackPageVisit(pagePath);
	};
}
