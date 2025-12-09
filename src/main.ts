import "./App.css";
import App from "./App.svelte";
import Announcement from "./Announcement.svelte";

// Check if debug parameter is set in search params
const searchParams = new URLSearchParams(window.location.search);
const debugMode = searchParams.has("debug");

if (debugMode) {
	new App({
		target: document.getElementById("app")!,
	});
} else {
	new Announcement({
		target: document.getElementById("app")!,
	});
}
