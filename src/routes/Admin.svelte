<script lang="ts">
	import { toast } from "svelte-sonner";
	import { LogOut, User as UserIcon, Users, TrendingUp, BarChart3 } from "lucide-svelte";
	import Layout from "@/components/Layout.svelte";
	import AccountForm from "@/components/AccountForm.svelte";
	import { authenticationStore, getVisitorStats } from "@/api";
	import { onMount } from "svelte";
	import type { VisitorStats } from "@/api/visitorCounter";

	let showSignInModal = false;

	// Visitor statistics
	let overallStats: VisitorStats | null = null;
	let radioStats: VisitorStats | null = null;
	let loadingStats = true;

	async function signOutHandler() {
		const { error } = await authenticationStore.signOut();
		if (error) {
			toast.error("Fel vid utloggning: " + error.message);
		} else {
			toast.success("Hej då!");
		}
	}

	async function handleSignInSuccess() {
		showSignInModal = false;
		// Reload stats after sign in
		await loadStatistics();
	}

	async function loadStatistics() {
		loadingStats = true;
		try {
			const [overall, radio] = await Promise.all([
				getVisitorStats(undefined, 7),
				getVisitorStats("/", 7),
			]);
			overallStats = overall;
			radioStats = radio;
		} catch (error) {
			console.error("Failed to load visitor statistics:", error);
		} finally {
			loadingStats = false;
		}
	}

	onMount(() => {
		loadStatistics();
	});

	function formatNumber(num: number): string {
		if (num >= 1000000) {
			return `${(num / 1000000).toFixed(1)}M`;
		} else if (num >= 1000) {
			return `${(num / 1000).toFixed(1)}K`;
		}
		return num.toString();
	}
</script>

<Layout>
	<div>
		{#if $authenticationStore}
			<div class="admin-dashboard">
				<!-- User info -->
				<div class="message is-success">
					<div class="message-header">
						<p>
							<span class="icon">
								<UserIcon />
							</span>
							<span>Administratör</span>
						</p>
					</div>
					<div class="message-body">
						<p class="mb-2">
							Du är inloggad som administratör och har tillgång till att administrera inspelningar
							och program
						</p>
						<p class="mb-4">
							<strong>{$authenticationStore.email}</strong>
							<br />
							<small
								>Konto skapat: {new Date($authenticationStore.created_at).toLocaleDateString(
									"sv-SE"
								)}</small
							>
							<br />
							<small>Är administratör: <b>Ja</b></small>
						</p>
						<button class="button is-fullwidth" on:click={signOutHandler}>
							<span class="icon">
								<LogOut size={16} />
							</span>
							<span>Logga ut</span>
						</button>
					</div>
				</div>

				<!-- Visitor Statistics Section -->
				<div class="statistics-section mt-5">
					<h2 class="title is-4 mb-4">
						<span class="icon">
							<BarChart3 />
						</span>
						<span>Besöksstatistik (senaste 7 dagarna)</span>
					</h2>

					{#if loadingStats}
						<div class="has-text-centered py-5">
							<button class="button is-loading is-large is-white"></button>
						</div>
					{:else}
						<!-- Main Statistics Cards -->
						<div class="columns is-multiline">
							<!-- Total Website Stats -->
							<div class="column is-one-third">
								<div class="box has-background-primary-light">
									<div class="is-flex is-align-items-center is-justify-content-space-between mb-2">
										<span class="icon is-large has-text-primary">
											<Users size={32} />
										</span>
										<div class="has-text-right">
											<p class="heading">Totala besök</p>
											<p class="title is-3 has-text-primary">
												{formatNumber(overallStats?.total_visits || 0)}
											</p>
										</div>
									</div>
									<p class="is-size-7 has-text-grey">Alla sidor tillsammans</p>
								</div>
							</div>

							<!-- Unique Visitors -->
							<div class="column is-one-third">
								<div class="box has-background-info-light">
									<div class="is-flex is-align-items-center is-justify-content-space-between mb-2">
										<span class="icon is-large has-text-info">
											<Users size={32} />
										</span>
										<div class="has-text-right">
											<p class="heading">Unika besökare</p>
											<p class="title is-3 has-text-info">
												{formatNumber(overallStats?.unique_visitors || 0)}
											</p>
										</div>
									</div>
									<p class="is-size-7 has-text-grey">Individuella enheter</p>
								</div>
							</div>

							<!-- Radio Listeners -->
							<div class="column is-one-third">
								<div class="box has-background-warning-light">
									<div class="is-flex is-align-items-center is-justify-content-space-between mb-2">
										<span class="icon is-large has-text-warning">
											<TrendingUp size={32} />
										</span>
										<div class="has-text-right">
											<p class="heading">Radiolyssnare</p>
											<p class="title is-3 has-text-warning">
												{formatNumber(radioStats?.unique_visitors || 0)}
											</p>
										</div>
									</div>
									<p class="is-size-7 has-text-grey">Unika lyssnare på radion</p>
								</div>
							</div>
						</div>

						<!-- Daily Trend -->
						{#if overallStats?.daily_stats && overallStats.daily_stats.length > 0}
							<div class="box">
								<h3 class="title is-5 mb-4">Daglig trend</h3>
								<div class="table-container">
									<table class="table is-fullwidth is-hoverable">
										<thead>
											<tr>
												<th>Datum</th>
												<th class="has-text-centered">Besök</th>
												<th class="has-text-centered">Unika</th>
											</tr>
										</thead>
										<tbody>
											{#each overallStats.daily_stats.slice().reverse() as day}
												<tr>
													<td>
														<strong
															>{new Date(day.date).toLocaleDateString("sv-SE", {
																weekday: "short",
																day: "numeric",
																month: "short",
															})}</strong
														>
													</td>
													<td class="has-text-centered">
														<span class="tag is-medium is-primary is-light">
															{day.visits}
														</span>
													</td>
													<td class="has-text-centered">
														<span class="tag is-medium is-info is-light">
															{day.unique_visitors}
														</span>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		{:else}
			<!-- Not logged in - show sign in prompt -->
			<div class="has-text-centered py-6">
				<div class="box" style="max-width: 500px; margin: 0 auto;">
					<h1 class="title is-4">Administratörspanel</h1>
					<p class="subtitle is-6 mb-5">
						Logga in för att se besöksstatistik och administrera Uddebo Radio
					</p>
					<button class="button is-primary is-medium" on:click={() => (showSignInModal = true)}>
						<span class="icon">
							<UserIcon />
						</span>
						<span>Logga in</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
</Layout>

<!-- Sign In Modal -->
{#if showSignInModal && !$authenticationStore}
	<AccountForm on:success={handleSignInSuccess} on:close={() => (showSignInModal = false)} />
{/if}

<style>
	.admin-dashboard {
		animation: fadeIn 0.3s ease-in;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.statistics-section {
		padding: 1rem 0;
	}

	.heading {
		text-transform: uppercase;
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		opacity: 0.8;
		margin-bottom: 0.5rem;
	}

	.table-container {
		overflow-x: auto;
	}

	.box.has-background-primary-light,
	.box.has-background-info-light,
	.box.has-background-warning-light {
		border: none;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}
</style>
