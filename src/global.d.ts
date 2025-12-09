/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="@sveltejs/kit" />
/// <reference types="svelte" />

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}

	// Custom type definitions
	interface Window {
		// Add any custom window properties here
	}
}

declare module "*.svelte" {
	import type { ComponentType } from "svelte";
	const component: ComponentType;
	export default component;
}

// Ensure this is treated as a module
export {};
