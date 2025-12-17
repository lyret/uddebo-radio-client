<script lang="ts">
	import { toast } from "svelte-sonner";
	import { LogOut, User as UserIcon, Eye, TrendingUp, BarChart3, Activity } from "lucide-svelte";
	import Layout from "@/components/Layout.svelte";
	import VisitorCounter from "@/components/VisitorCounter.svelte";
	import AccountForm from "@/components/AccountForm.svelte";
	import { authenticationStore, getVisitorStats } from "@/api";
	import { onMount } from "svelte";
	import type { VisitorStats } from "@/api/visitorCounter";

	let showSignInModal = false;

	// Visitor statistics
	let overallStats: VisitorStats | null = null;
	let playerStats: VisitorStats | null = null;
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
			const [overall, player] = await Promise.all([
				getVisitorStats(undefined, 30),
				getVisitorStats("/player", 30),
			]);
			overallStats = overall;
			playerStats = player;
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
						<span>Besöksstatistik</span>
					</h2>

					{#if loadingStats}
						<div class="has-text-centered py-5">
							<button class="button is-loading is-large is-white"></button>
						</div>
					{:else}
						<div class="columns is-multiline">
							<!-- Overall Statistics -->
							<div class="column is-full">
								<div class="box">
									<h3 class="title is-5 mb-4">
										<span class="icon has-text-info">
											<Activity />
										</span>
										<span>Övergripande statistik (senaste 30 dagarna)</span>
									</h3>
									{#if overallStats}
										<div class="level">
											<div class="level-item has-text-centered">
												<div>
													<p class="heading">Totalt antal besök</p>
													<p class="title has-text-primary">
														{formatNumber(overallStats.total_visits)}
													</p>
												</div>
											</div>
											<div class="level-item has-text-centered">
												<div>
													<p class="heading">Unika besökare</p>
													<p class="title has-text-info">
														{formatNumber(overallStats.unique_visitors)}
													</p>
												</div>
											</div>
											<div class="level-item has-text-centered">
												<div>
													<p class="heading">Antal sidor</p>
													<p class="title has-text-success">{overallStats.pages?.length || 0}</p>
												</div>
											</div>
										</div>

										{#if overallStats.pages && overallStats.pages.length > 0}
											<div class="content">
												<p class="has-text-weight-semibold mb-2">Besökta sidor:</p>
												<div class="tags">
													{#each overallStats.pages as page}
														<span class="tag is-medium is-light">{page}</span>
													{/each}
												</div>
											</div>
										{/if}
									{:else}
										<p class="has-text-grey">Ingen statistik tillgänglig</p>
									{/if}
								</div>
							</div>

							<!-- Player Page Statistics -->
							<div class="column is-half">
								<div class="box">
									<h3 class="title is-6 mb-3">
										<span class="icon has-text-warning">
											<Eye />
										</span>
										<span>Radion</span>
									</h3>
									{#if playerStats}
										<div class="content">
											<p class="mb-2">
												<strong>Besök:</strong>
												{formatNumber(playerStats.total_visits)}
											</p>
											<p class="mb-2">
												<strong>Unika lyssnare:</strong>
												{formatNumber(playerStats.unique_visitors)}
											</p>
										</div>
									{:else}
										<p class="has-text-grey">Ingen data</p>
									{/if}
								</div>
							</div>

							<!-- Live Counter Widget -->
							<div class="column is-half">
								<div class="box">
									<h3 class="title is-6 mb-3">
										<span class="icon has-text-danger">
											<TrendingUp />
										</span>
										<span>Live räknare (alla sidor)</span>
									</h3>
									<VisitorCounter showDetails={false} autoTrack={false} />
								</div>
							</div>
						</div>

						<!-- Daily Statistics Chart -->
						{#if overallStats?.daily_stats && overallStats.daily_stats.length > 0}
							<div class="box mt-4">
								<h3 class="title is-5 mb-4">Daglig statistik</h3>
								<div class="table-container">
									<table class="table is-fullwidth is-striped">
										<thead>
											<tr>
												<th>Datum</th>
												<th class="has-text-right">Besök</th>
												<th class="has-text-right">Unika besökare</th>
											</tr>
										</thead>
										<tbody>
											{#each overallStats.daily_stats.slice(0, 7) as day}
												<tr>
													<td>
														{new Date(day.date).toLocaleDateString("sv-SE", {
															weekday: "long",
															day: "numeric",
															month: "short",
														})}
													</td>
													<td class="has-text-right">{day.visits}</td>
													<td class="has-text-right">{day.unique_visitors}</td>
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

	.level-item .title {
		font-size: 2rem;
		margin-bottom: 0;
	}

	.level-item .heading {
		text-transform: uppercase;
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		opacity: 0.7;
	}

	.table-container {
		max-height: 400px;
		overflow-y: auto;
	}
</style>
