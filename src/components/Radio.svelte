<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { fade, scale } from "svelte/transition";
	import { quintOut } from "svelte/easing";

	export let power = false;
	export let coverUrl: string | undefined = undefined;
	export let display1: string | undefined = undefined;
	export let display2: string | undefined = undefined;
	export let display3: string | undefined = undefined;

	// Check if display3 is a URL
	$: isDisplay3Url =
		display3 && (display3.startsWith("http://") || display3.startsWith("https://"));

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
			<div class="display row-3" in:fade={{ duration: 1200, delay: 600 }}>
				{#if isDisplay3Url}
					<a href={display3} target="_blank" rel="noopener noreferrer" class="display-link">
						{display3}
					</a>
				{:else}
					{display3 || ""}
				{/if}
			</div>
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
		box-shadow: 0 0 10px #cd4276;
		animation: crt-turn-on 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
	}

	.cover-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		animation: crt-flicker 0.15s infinite;
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
		color: #cd4276;
		font-family: monospace;
		transition: all 1s ease;
	}
	.display-area.is-on {
		background-color: rgba(0, 0, 0, 0.9);
		box-shadow: 0 0 10px #cd4276;
		animation: crt-turn-on 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
	}

	.display {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		opacity: 0.8;
		font-weight: bold;
		text-shadow: 0 0 3px #cd4276;
		animation: crt-text-glow 2s ease-in-out infinite alternate;
	}
	.display.row-1 {
		font-size: 0.975rem;
		margin-bottom: 0.3rem;
	}

	.display.row-2 {
		font-size: 0.85rem;
	}
	.display.row-3 {
		font-size: 0.85rem;
	}

	.display-link {
		color: inherit;
		text-decoration: none;
		opacity: 0.9;
		transition: opacity 0.2s ease;
	}

	.display-link:hover {
		opacity: 1;
		text-decoration: underline;
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
			rgba(205, 66, 118, 0.1) 0%,
			rgba(205, 66, 118, 0.05) 40%,
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
				0 0 3px #cd4276,
				0 0 5px #cd4276;
			opacity: 0.8;
		}
		100% {
			text-shadow:
				0 0 4px #cd4276,
				0 0 8px #cd4276,
				0 0 12px rgb(205, 66, 118, 0.5);
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

	@media (orientation: portrait) and (max-width: 700px) {
		.wrapper {
			position: relative;
			display: block;
			width: 100vw;
			height: 180vw;
		}

		.radio-image {
			background-image: url("/radio-mobile.png");
			height: 100%;
			width: 100%;
			display: block;
			object-fit: contain;
			background-repeat: no-repeat;
			background-position: center;
			background-size: contain;
		}

		.cover-area {
			left: 11vw;
			top: 70vw;
			height: 81vw;
			width: 80vw;
		}

		.display-area {
			left: 11vw;
			top: 10vw;
			width: 80vw;
			height: 44vw;
		}

		.display-area {
			padding: 2.5vw;
		}

		.display.row-1 {
			font-size: 5vw;
		}

		.display.row-2 {
			font-size: 4.5vw;
		}
		.display.row-3 {
			font-size: 4.5vw;
		}

		.power-button {
			position: absolute;
			left: unset;
			width: 16vw;
			height: 16vw;
			top: 156vw;
			right: 12%;
		}
	}
</style>
