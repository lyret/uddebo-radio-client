<script lang="ts">
	export let isPlaying = false;
	export let currentTrack = {
		title: "No track playing",
		artist: "—",
		coverUrl: "",
	};

	export function togglePlayback() {
		isPlaying = !isPlaying;
	}
</script>

<div class="wrapper">
	<!-- Cover image area -->
	<div class="cover-area">
		{#if currentTrack.coverUrl}
			<img src={currentTrack.coverUrl} alt="Album cover" class="cover-image" />
		{:else}
			<div class="cover-placeholder"></div>
		{/if}
	</div>

	<!-- Radio image -->
	<div class="radio-image" />

	<!-- Display area for track info -->
	<div class="display-area">
		<div class="track-title">{currentTrack.title}</div>
		<div class="track-artist">{currentTrack.artist}</div>
	</div>

	<!-- Power button -->
	<button
		class="power-button"
		class:active={isPlaying}
		on:click={togglePlayback}
		aria-label={isPlaying ? "Stop radio" : "Start radio"}
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
	/*@media screen and (orientation: portrait) {
		.radio-image {
			background-image: url("/radio-mobile.png");
		}
	}*/

	/* Cover image area - positioned absolute over the radio */
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

	.track-title {
		font-size: 0.875rem;
		font-weight: bold;
		margin-bottom: 0.25rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.track-artist {
		font-size: 0.75rem;
		opacity: 0.8;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Power button - positioned absolute over the radio */
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

		.track-title {
			font-size: 0.75rem;
		}

		.track-artist {
			font-size: 0.625rem;
		}
	}

	@media (max-width: 480px) {
		.display-area {
			padding: 0.25rem;
		}

		.track-title {
			font-size: 0.625rem;
		}

		.track-artist {
			font-size: 0.5rem;
		}
	}
</style>
