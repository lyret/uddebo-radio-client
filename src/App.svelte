<script lang="ts">
	import Router from "svelte-spa-router";
	import { QueryClient, QueryClientProvider } from "@tanstack/svelte-query";
	import { Toaster } from "svelte-sonner";

	// Import routes
	import Index from "./routes/Index.svelte";
	import NotFound from "./routes/NotFound.svelte";

	// Define routes
	const routes = {
		"/": Index,
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
</script>

<Toaster richColors closeButton />

<QueryClientProvider client={queryClient}>
	<Router {routes} />
</QueryClientProvider>
