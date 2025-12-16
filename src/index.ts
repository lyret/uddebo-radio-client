import "./index.scss";
import App from "./App.svelte";
import Announcement from "./Announcement.svelte";
import { authenticationStore } from "./api";

// Check if debug parameter is set in search params
const searchParams = new URLSearchParams(window.location.search);
const debugMode = searchParams.has("debug");

if (debugMode) {
	authenticationStore.initialize().then(() => {
		new App({
			target: document.getElementById("app")!,
		});
	});
} else {
	new Announcement({
		target: document.getElementById("app")!,
	});
}
