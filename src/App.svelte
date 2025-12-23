<script lang="ts">
	import Router, { location } from "svelte-spa-router";
	import { QueryClient, QueryClientProvider } from "@tanstack/svelte-query";
	import { Toaster } from "svelte-sonner";
	import { onMount } from "svelte";
	import { trackPageVisit } from "./api";

	// Import routes
	import Player from "./routes/Player.svelte";
	import Upload from "./routes/Upload.svelte";
	import Admin from "./routes/Admin.svelte";
	import Programs from "./routes/Programs.svelte";
	import Recordings from "./routes/Recordings.svelte";
	import NotFound from "./routes/NotFound.svelte";
	import Announcement from "./routes/Announcement.svelte";

	// Define routes
	const routes = {
		"/": Player,
		"/announcement": Announcement,
		"/live": Player,
		"/upload": Upload,
		"/admin": Admin,
		"/programs": Programs,
		"/recordings": Recordings,
		"*": NotFound,
	};

	// Create query client
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60 * 1000,
			},
		},
	});

	// Track page visits on route changes
	$: if ($location) {
		trackPageVisit($location);
	}

	// Track initial page visit on mount
	onMount(() => {
		trackPageVisit($location);
	});
</script>

<Toaster
	toastOptions={{
		unstyled: true,
		classes: {
			toast: "notification",
			error: "is-danger",
			success: "is-success",
			warning: "is-warning",
			info: "is-info",
			cancelButton: "delete",
			closeButton: "delete",
		},
	}}
/>

<QueryClientProvider client={queryClient}>
	<Router {routes} />
</QueryClientProvider>
