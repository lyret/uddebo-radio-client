<script lang="ts">
	import { location } from "svelte-spa-router";

	$: if ($location) {
		console.error("404 Error: User attempted to access non-existent route:", $location);
	}
</script>

<section class="hero is-fullheight">
	<div class="hero-body">
		<div class="container has-text-centered">
			<h1 class="title is-1 has-text-danger">404</h1>
			<p class="subtitle is-4">Oops! Page not found</p>
			<a href="#/" class="button is-primary">
				<span>Return to Home</span>
			</a>
		</div>
	</div>
</section>
