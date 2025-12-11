<script lang="ts">
	import { createEventDispatcher } from "svelte";

	export let power = false;
	export let coverUrl: string | undefined = undefined;
	export let display1: string | undefined = undefined;
	export let display2: string | undefined = undefined;
	export let display3: string | undefined = undefined;

	const dispatch = createEventDispatcher<{ power: boolean }>();

	export function togglePower() {
		power = !power;
		dispatch("power", power);
	}
</script>

<div class="wrapper">
	<!-- Cover image area -->
	<div class="cover-area">
		{#if power && coverUrl}
			<img src={coverUrl} alt="Album cover" class="cover-image" />
		{:else}
			<div class="cover-placeholder"></div>
		{/if}
	</div>

	<!-- Radio image -->
	<div class="radio-image" />

	<!-- Display area for track info -->
	<div class="display-area">
		{#if power}
			<div class="display row-1">{display1 || ""}</div>
			<div class="display row-2">{display2 || ""}</div>
			<div class="display row-3">{display3 || ""}</div>
		{/if}
	</div>

	<!-- Power button -->
	<button
		class="power-button"
		class:active={power}
		on:click={togglePower}
		aria-label={power ? "Stop radio" : "Start radio"}
	/>
</div>

<style>
	.wrapper {
		position: relative;
		display: block;
		width: 800px;
		height: 800px;
		left: 50%;
		translate: -50%;
	}

	.radio-image {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: contain;
		background-image: url("/radio-desktop.png");
		background-repeat: no-repeat;
		background-position: center;
		background-size: contain;
	}

	.cover-area {
		position: absolute;
		left: 285px;
		top: 472px;
		width: 229px;
		height: 229px;
		background: #000;
		overflow: hidden;
	}

	.cover-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.cover-placeholder {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
	}

	/* Display area - positioned absolute over the radio */
	.display-area {
		position: absolute;
		left: 285px;
		top: 304px;
		width: 229px;
		height: 124px;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.8);
		border-radius: 4px;
		color: #00ff00;
		font-family: monospace;
	}

	.display {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		opacity: 0.8;
		font-weight: bold;
	}
	.display.row-1 {
		font-size: 0.875rem;
		margin-bottom: 0.25rem;
	}

	.display.row-2 {
		font-size: 0.75rem;
	}
	.display.row-2 {
		font-size: 0.75rem;
	}
	.display.row-3 {
		font-size: 0.75rem;
	}

	.power-button {
		position: absolute;
		left: 452px;
		top: 710px;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		background-color: none;
		background-image: url("/power-button-off.png");
		background-repeat: no-repeat;
		background-position: center;
		background-size: contain;
		transition: all 0.2s ease;
	}

	.power-button:hover {
		transform: scale(1.02);
	}
	.power-button:active {
		transform: scale(0.96);
	}

	.power-button.active {
		background-image: url("/power-button-on.png");
		box-shadow: 0 0 20px rgba(255, 51, 51, 0.5);
	}

	.power-button.active:hover {
		box-shadow: 0 0 20px rgba(255, 51, 51, 0.5);
	}

	/* Responsive adjustments for smaller text */
	@media (max-width: 768px) {
		.display-area {
			padding: 0.5rem;
		}

		.display.row-1 {
			font-size: 0.75rem;
		}

		.display.row-2 {
			font-size: 0.625rem;
		}
	}

	@media (max-width: 480px) {
		.display-area {
			padding: 0.25rem;
		}

		.display.row-1 {
			font-size: 0.625rem;
		}

		.display.row-2 {
			font-size: 0.5rem;
		}
	}
</style>
