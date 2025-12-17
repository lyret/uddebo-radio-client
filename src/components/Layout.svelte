<script lang="ts">
	import { Radio, Upload, User, Calendar, FileAudio } from "lucide-svelte";
	import { link, location } from "svelte-spa-router";
	import { isAdmin } from "@/api";
	import { slide, blur } from "svelte/transition";

	export let requiresAdmin = false;
	export let fullWidth = false;

	$: currentPath = $location;
</script>

<div class="container is-fluid">
	<!-- Header for admins -->
	{#if $isAdmin}
		<section class="header" transition:blur>
			<div class="mt-6" />
			<div class="level">
				<div class="level-left">
					<div class="level-item">
						<img
							class="image"
							src="/logo.png"
							alt="UR Logo"
							style="max-height: 80px; width: auto;"
						/>
					</div>
					<div class="level-item">
						<h1 class="title">Uddebo&nbsp;Radio&nbsp;Administration</h1>
					</div>
				</div>
			</div>
		</section>
	{/if}

	<!-- Main Content -->
	<section class="section">
		<div class="container">
			<div class="columns is-centered">
				<div class="column" class:is-10-tablet={!fullWidth} class:is-8-desktop={!fullWidth}>
					<!-- Admin Navigation Tabs -->
					{#if $isAdmin}
						<div class="tabs is-centered is-boxed" transition:slide>
							<ul>
								<li class:is-active={currentPath === "/"}>
									<a href="/" use:link>
										<span>Hem</span>
									</a>
								</li>
								<li class:is-active={currentPath === "/live"}>
									<a href="/live" use:link>
										<span class="icon is-small">
											<Radio size={16} />
										</span>
										<span>Radion</span>
									</a>
								</li>
								<li class:is-active={currentPath === "/upload"}>
									<a href="/upload" use:link>
										<span class="icon is-small">
											<Upload size={16} />
										</span>
										<span>Ladda upp</span>
									</a>
								</li>
								<li class:is-active={currentPath === "/admin"}>
									<a href="/admin" use:link>
										<span class="icon is-small">
											<User size={16} />
										</span>
										<span>Användning</span>
									</a>
								</li>
								<li class:is-active={currentPath === "/programs"}>
									<a href="/programs" use:link>
										<span class="icon is-small">
											<Calendar size={16} />
										</span>
										<span>Program</span>
									</a>
								</li>
								<li class:is-active={currentPath === "/recordings"}>
									<a href="/recordings" use:link>
										<span class="icon is-small">
											<FileAudio size={16} />
										</span>
										<span>Inspelningar</span>
									</a>
								</li>
							</ul>
						</div>
					{/if}

					<!-- Tab Content -->
					{#if !requiresAdmin || $isAdmin}
						<slot />
					{:else}
						<div class="container has-text-centered">
							<h1 class="title is-1 has-text-danger">500</h1>
							<p class="subtitle is-4">Du måste vara inloggad för att komma åt den här sidan</p>
							<a href="#/" class="button is-primary">
								<span>Gå till startsidan</span>
							</a>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</section>
</div>
