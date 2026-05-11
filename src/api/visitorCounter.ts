import { pb } from "./pb";

function getVisitorId(): string {
	const storageKey = "uddebo_visitor_id";
	let visitorId = localStorage.getItem(storageKey);

	if (!visitorId) {
		visitorId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
		localStorage.setItem(storageKey, visitorId);
	}

	return visitorId;
}

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

export async function recordVisit(
	pagePath: string,
	options?: {
		userAgent?: string;
		referrer?: string;
	}
): Promise<VisitorStats | null> {
	try {
		const visitorId = getVisitorId();

		await pb.collection("visitor_stats").create(
			{
				page_path: pagePath,
				visitor_id: visitorId,
				user_agent: options?.userAgent || navigator.userAgent || undefined,
				referrer: options?.referrer || document.referrer || undefined,
				visited_at: new Date().toISOString(),
			},
			{ requestKey: null }
		);

		return getVisitorStats(pagePath);
	} catch (err) {
		console.error("Failed to record visit:", err);
		return null;
	}
}

export async function getVisitorStats(
	pagePath?: string,
	daysBack: number = 30
): Promise<VisitorStats | null> {
	try {
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - daysBack);
		startDate.setHours(0, 0, 0, 0);

		const filters: string[] = [`visited_at >= "${startDate.toISOString()}"`];
		if (pagePath) {
			filters.push(`page_path = "${pagePath}"`);
		}

		const records = await pb.collection("visitor_stats").getFullList({
			filter: filters.join(" && "),
			requestKey: null,
		});

		const total_visits = records.length;
		const uniqueVisitorIds = new Set(records.map((r) => r.visitor_id));
		const unique_visitors = uniqueVisitorIds.size;

		// Aggregate per-day stats
		const dailyMap = new Map<string, { visits: number; uniqueIds: Set<string> }>();
		for (const record of records) {
			const date = (record.visited_at || record.created).substring(0, 10);
			if (!dailyMap.has(date)) {
				dailyMap.set(date, { visits: 0, uniqueIds: new Set() });
			}
			const day = dailyMap.get(date)!;
			day.visits++;
			day.uniqueIds.add(record.visitor_id);
		}

		const daily_stats = Array.from(dailyMap.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([date, { visits, uniqueIds }]) => ({
				date,
				visits,
				unique_visitors: uniqueIds.size,
			}));

		return {
			page_path: pagePath,
			total_visits,
			unique_visitors,
			period_days: daysBack,
			daily_stats,
		};
	} catch (err) {
		console.error("Failed to get visitor stats:", err);
		return null;
	}
}

export async function getTodayVisitorCount(pagePath?: string): Promise<number> {
	try {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const filters: string[] = [`visited_at >= "${today.toISOString()}"`];
		if (pagePath) {
			filters.push(`page_path = "${pagePath}"`);
		}

		const records = await pb.collection("visitor_stats").getFullList({
			filter: filters.join(" && "),
			requestKey: null,
		});

		return records.length;
	} catch (err) {
		console.error("Failed to get today's visitor count:", err);
		return 0;
	}
}

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

export async function trackPageVisit(pagePath?: string): Promise<VisitorStats | null> {
	const path = pagePath || window.location.pathname;
	return recordVisit(path);
}

export function createVisitorTracker() {
	return async (pagePath?: string) => {
		await new Promise((resolve) => setTimeout(resolve, 100));
		return trackPageVisit(pagePath);
	};
}
