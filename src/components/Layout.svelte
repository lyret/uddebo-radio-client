<script lang="ts">
	import { Radio, Upload, User, Calendar, FileAudio } from "lucide-svelte";
	import { link, location } from "svelte-spa-router";
	import { isAdmin } from "@/api";

	export let fullWidth = false;

	$: currentPath = $location;
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
				<div class="column" class:is-10-tablet={!fullWidth} class:is-8-desktop={!fullWidth}>
					<!-- Navigation Tabs -->
					<div class="tabs is-centered is-boxed">
						<ul>
							<li class:is-active={currentPath === "/"}>
								<a href="/" use:link>
									<span class="icon is-small">
										<Radio size={16} />
									</span>
									<span>Radio Player</span>
								</a>
							</li>
							<li class:is-active={currentPath === "/upload"}>
								<a href="/upload" use:link>
									<span class="icon is-small">
										<Upload size={16} />
									</span>
									<span>Upload</span>
								</a>
							</li>
							<li class:is-active={currentPath === "/account"}>
								<a href="/account" use:link>
									<span class="icon is-small">
										<User size={16} />
									</span>
									<span>Account</span>
								</a>
							</li>
							{#if $isAdmin}
								<li class:is-active={currentPath === "/programs"}>
									<a href="/programs" use:link>
										<span class="icon is-small">
											<Calendar size={16} />
										</span>
										<span>Programs</span>
									</a>
								</li>
								<li class:is-active={currentPath === "/recordings"}>
									<a href="/recordings" use:link>
										<span class="icon is-small">
											<FileAudio size={16} />
										</span>
										<span>Recordings</span>
									</a>
								</li>
							{/if}
						</ul>
					</div>

					<!-- Tab Content -->
					<div class="box">
						<slot />
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
