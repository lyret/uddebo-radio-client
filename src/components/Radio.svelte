<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { fade, scale } from "svelte/transition";
	import { quintOut } from "svelte/easing";

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
	<div class="cover-area" class:is-on={power}>
		{#if power && coverUrl}
			<img
				src={coverUrl}
				alt="Album cover"
				class="cover-image"
				in:scale={{ duration: 800, opacity: 0, start: 0.2, easing: quintOut }}
				out:fade={{ duration: 300 }}
			/>
		{/if}
		{#if power}
			<div class="crt-lines" />
			<div class="crt-glow" />
		{/if}
	</div>

	<!-- Radio image -->
	<div class="radio-image" />

	<!-- Display area for track info -->
	<div class="display-area" class:is-on={power}>
		{#if power}
			<div class="display row-1" in:fade={{ duration: 1200, delay: 200 }}>{display1 || ""}</div>
			<div class="display row-2" in:fade={{ duration: 1200, delay: 400 }}>{display2 || ""}</div>
			<div class="display row-3" in:fade={{ duration: 1200, delay: 600 }}>{display3 || ""}</div>
			<div class="crt-lines" />
			<div class="crt-glow" />
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
		background: rgba(0, 0, 0, 0.8);
		overflow: hidden;
		transition: all 1s ease;
	}
	.cover-area.is-on {
		background-color: rgba(0, 0, 0, 0.9);
		box-shadow: 0 0 10px #00ff00;
		animation: crt-turn-on 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
	}

	.cover-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		animation: crt-flicker 0.15s infinite;
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
		transition: all 1s ease;
	}
	.display-area.is-on {
		background-color: rgba(0, 0, 0, 0.9);
		box-shadow: 0 0 10px #00ff00;
		animation: crt-turn-on 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
	}

	.display {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		opacity: 0.8;
		font-weight: bold;
		text-shadow: 0 0 3px #00ff00;
		animation: crt-text-glow 2s ease-in-out infinite alternate;
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

	/* CRT Effects */
	.crt-lines {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		background: linear-gradient(to bottom, rgba(255, 255, 255, 0) 50%, rgba(0, 255, 0, 0.02) 50%);
		background-size: 100% 4px;
		animation: crt-scanlines 8s linear infinite;
		z-index: 2;
	}

	.crt-glow {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		background: radial-gradient(
			ellipse at center,
			rgba(0, 255, 0, 0.1) 0%,
			rgba(0, 255, 0, 0.05) 40%,
			transparent 70%
		);
		animation: crt-pulse 4s ease-in-out infinite;
		z-index: 1;
	}

	/* Keyframe animations */
	@keyframes crt-turn-on {
		0% {
			transform: scaleY(0.01) scaleX(1);
			filter: brightness(30);
		}
		10% {
			transform: scaleY(0.01) scaleX(0.8);
		}
		20% {
			transform: scaleY(0.2) scaleX(1.2);
			filter: brightness(10);
		}
		40% {
			transform: scaleY(1) scaleX(1.1);
			filter: brightness(4);
		}
		60% {
			transform: scaleY(1) scaleX(1.05);
			filter: brightness(2);
		}
		80% {
			transform: scaleY(1) scaleX(1.02);
			filter: brightness(1.2);
		}
		100% {
			transform: scaleY(1) scaleX(1);
			filter: brightness(1);
		}
	}

	@keyframes crt-scanlines {
		0% {
			transform: translateY(0);
		}
		100% {
			transform: translateY(10px);
		}
	}

	@keyframes crt-flicker {
		0% {
			opacity: 1;
		}
		50% {
			opacity: 0.98;
		}
		100% {
			opacity: 1;
		}
	}

	@keyframes crt-text-glow {
		0% {
			text-shadow:
				0 0 3px #00ff00,
				0 0 5px #00ff00;
			opacity: 0.8;
		}
		100% {
			text-shadow:
				0 0 4px #00ff00,
				0 0 8px #00ff00,
				0 0 12px rgba(0, 255, 0, 0.5);
			opacity: 0.9;
		}
	}

	@keyframes crt-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.8;
		}
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

	@media (orientation: portrait) and (max-width: 700px) {
		.wrapper {
			background-color: black;
		}
		.radio-image {
			background-image: url("/radio-mobile.png");
		}
	}
</style>
