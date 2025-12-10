<script lang="ts">
	import Router from "svelte-spa-router";
	import { QueryClient, QueryClientProvider } from "@tanstack/svelte-query";
	import { Toaster } from "svelte-sonner";

	// Import routes
	import Player from "./routes/Player.svelte";
	import Upload from "./routes/Upload.svelte";
	import Account from "./routes/Account.svelte";
	import Programs from "./routes/Programs.svelte";
	import Recordings from "./routes/Recordings.svelte";
	import NotFound from "./routes/NotFound.svelte";

	// Define routes
	const routes = {
		"/": Player,
		"/upload": Upload,
		"/account": Account,
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
</script>

<Toaster richColors closeButton />

<QueryClientProvider client={queryClient}>
	<Router {routes} />
</QueryClientProvider>
