import "./index.scss";
import App from "./App.svelte";
import { authenticationStore } from "./api";

// Check if debug parameter is set in search params
const searchParams = new URLSearchParams(window.location.search);

authenticationStore.initialize().then(() => {
	new App({
		target: document.getElementById("app")!,
	});
});
