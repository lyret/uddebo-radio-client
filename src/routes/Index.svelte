<script lang="ts">
	import { Radio, Upload, User, Calendar } from "lucide-svelte";
	import RadioPlayer from "@/components/RadioPlayer.svelte";
	import RecordingUpload from "@/components/RecordingUpload.svelte";
	import AccountAuth from "@/components/AccountAuth.svelte";
	import BroadcastPrograms from "@/components/BroadcastPrograms.svelte";
	import { isAdmin } from "@/api";

	let activeTab = "player";
</script>

<div class="container is-fluid">
	<!-- Header -->
	<section class="hero is-primary">
		<div class="hero-body">
			<div class="container">
				<h1 class="title">
					<span class="icon">
						<Radio size={32} />
					</span>
					Uddebo Radio
				</h1>
				<p class="subtitle">Community-driven radio streaming - Everyone can upload!</p>
			</div>
		</div>
	</section>

	<!-- Main Content -->
	<section class="section">
		<div class="container">
			<div class="columns is-centered">
				<div class="column is-10-tablet is-8-desktop">
					<!-- Tabs -->
					<div class="tabs is-centered is-boxed">
						<ul>
							<li class:is-active={activeTab === "player"}>
								<a href="#player" on:click|preventDefault={() => (activeTab = "player")}>
									<span class="icon is-small">
										<Radio size={16} />
									</span>
									<span>Radio Player</span>
								</a>
							</li>
							<li class:is-active={activeTab === "upload"}>
								<a href="#upload" on:click|preventDefault={() => (activeTab = "upload")}>
									<span class="icon is-small">
										<Upload size={16} />
									</span>
									<span>Upload</span>
								</a>
							</li>
							<li class:is-active={activeTab === "account"}>
								<a href="#account" on:click|preventDefault={() => (activeTab = "account")}>
									<span class="icon is-small">
										<User size={16} />
									</span>
									<span>Account</span>
								</a>
							</li>
							{#if $isAdmin}
								<li class:is-active={activeTab === "programs"}>
									<a href="#programs" on:click|preventDefault={() => (activeTab = "programs")}>
										<span class="icon is-small">
											<Calendar size={16} />
										</span>
										<span>Programs</span>
									</a>
								</li>
							{/if}
						</ul>
					</div>

					<!-- Tab Content -->
					<div class="box">
						{#if activeTab === "player"}
							<RadioPlayer />
						{:else if activeTab === "upload"}
							<RecordingUpload />
						{:else if activeTab === "account"}
							<AccountAuth />
						{:else if activeTab === "programs"}
							<BroadcastPrograms />
						{/if}
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="footer">
		<div class="content has-text-centered">
			<p>© 2024 Uddebo Radio - Sharing music, connecting communities</p>
		</div>
	</footer>
</div>
