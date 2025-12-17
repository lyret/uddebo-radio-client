<script lang="ts">
	import { onMount } from "svelte";
	import { Eye, Users, TrendingUp } from "lucide-svelte";
	import { trackPageVisit, getTodayVisitorCount, getUniqueVisitorCount, getVisitorStats } from "@/api/visitorCounter";
	import type { VisitorStats } from "@/api/visitorCounter";

	export let pagePath: string | undefined = undefined;
	export let showDetails: boolean = false;
	export let autoTrack: boolean = true;
	export let className: string = "";

	let todayCount: number = 0;
	let uniqueCount: number = 0;
	let totalCount: number = 0;
	let stats: VisitorStats | null = null;
	let loading: boolean = true;

	onMount(async () => {
		// Track the current visit if autoTrack is enabled
		if (autoTrack) {
			const visitStats = await trackPageVisit(pagePath);
			if (visitStats) {
				todayCount = visitStats.today_visits || 0;
				totalCount = visitStats.total_visits;
			}
		}

		// Load additional statistics
		await loadStats();
		loading = false;
	});

	async function loadStats() {
		const [today, unique, fullStats] = await Promise.all([
			getTodayVisitorCount(pagePath),
			getUniqueVisitorCount(pagePath, 30),
			showDetails ? getVisitorStats(pagePath, 7) : Promise.resolve(null)
		]);

		todayCount = today;
		uniqueCount = unique;
		stats = fullStats;
		if (fullStats) {
			totalCount = fullStats.total_visits;
		}
	}

	function formatNumber(num: number): string {
		if (num >= 1000000) {
			return `${(num / 1000000).toFixed(1)}M`;
		} else if (num >= 1000) {
			return `${(num / 1000).toFixed(1)}K`;
		}
		return num.toString();
	}
</script>

<div class="visitor-counter {className}" class:loading>
	<div class="counter-badges">
		<div class="counter-badge today">
			<Eye size={16} />
			<span class="count">{formatNumber(todayCount)}</span>
			<span class="label">idag</span>
		</div>

		<div class="counter-badge unique">
			<Users size={16} />
			<span class="count">{formatNumber(uniqueCount)}</span>
			<span class="label">unika</span>
		</div>

		{#if totalCount > 0}
			<div class="counter-badge total">
				<TrendingUp size={16} />
				<span class="count">{formatNumber(totalCount)}</span>
				<span class="label">totalt</span>
			</div>
		{/if}
	</div>

	{#if showDetails && stats?.daily_stats}
		<div class="daily-stats">
			<h4>Senaste 7 dagarna</h4>
			<div class="stats-list">
				{#each stats.daily_stats as day}
					<div class="stat-row">
						<span class="date">{new Date(day.date).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" })}</span>
						<span class="visits">{day.visits} besök</span>
						<span class="unique">{day.unique_visitors} unika</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.visitor-counter {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 0.5rem;
		backdrop-filter: blur(10px);
		transition: opacity 0.3s ease;

		&.loading {
			opacity: 0.5;
		}
	}

	.counter-badges {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
	}

	.counter-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 2rem;
		font-size: 0.875rem;
		transition: transform 0.2s ease, background 0.2s ease;

		&:hover {
			transform: translateY(-2px);
			background: rgba(255, 255, 255, 0.15);
		}

		:global(svg) {
			opacity: 0.7;
		}

		.count {
			font-weight: 600;
			font-size: 1rem;
		}

		.label {
			opacity: 0.7;
			font-size: 0.75rem;
		}

		&.today {
			.count {
				color: #4ade80;
			}
		}

		&.unique {
			.count {
				color: #60a5fa;
			}
		}

		&.total {
			.count {
				color: #fbbf24;
			}
		}
	}

	.daily-stats {
		margin-top: 0.5rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.1);

		h4 {
			margin: 0 0 0.75rem 0;
			font-size: 0.875rem;
			opacity: 0.7;
			text-align: center;
		}

		.stats-list {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		.stat-row {
			display: grid;
			grid-template-columns: 1fr auto auto;
			gap: 1rem;
			padding: 0.375rem 0.5rem;
			font-size: 0.8125rem;
			border-radius: 0.25rem;
			transition: background 0.2s ease;

			&:hover {
				background: rgba(255, 255, 255, 0.05);
			}

			.date {
				font-weight: 500;
			}

			.visits {
				opacity: 0.8;
			}

			.unique {
				opacity: 0.6;
				font-size: 0.75rem;
			}
		}
	}

	@media (max-width: 640px) {
		.counter-badges {
			flex-direction: column;
			gap: 0.5rem;
		}

		.counter-badge {
			width: 100%;
			justify-content: center;
		}
	}
</style>
