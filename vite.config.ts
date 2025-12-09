import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "node:path";

/** @see https://vitejs.dev/config/ */
export default defineConfig({
	base: "/",
	plugins: [svelte()],
	build: {
		outDir: "./.dist",
		emptyOutDir: true,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		host: "0.0.0.0",
		port: 5173,
	},
});
