<script lang="ts">
	import Layout from "@/components/Layout.svelte";
	import Radio from "@/components/Radio.svelte";

	// Player state
	let isPlaying = false;
	let currentTrack = {
		title: "No track playing",
		artist: "—",
		coverUrl: "",
	};
	let instructions = "Press the power button to start listening";

	// Toggle play/pause
	function togglePlayback() {
		isPlaying = !isPlaying;
		if (isPlaying) {
			instructions = "Now playing from Uddebo Radio";
			// TODO: Start actual playback
		} else {
			instructions = "Press the power button to start listening";
			// TODO: Stop actual playback
		}
	}
</script>

<Layout>
	<div class="player-container">
		<div class="top-margin" />

		<!-- Instructions area below the radio -->
	</div>
</Layout>
<Radio bind:isPlaying {currentTrack} on:click={togglePlayback} />
<footer class="has-text-centered is-flex-align-items-flex-end mt-auto">
	<div class="instructions">
		{instructions}
	</div>
</footer>

<style>
	footer {
		position: fixed;
		left: 0;
		bottom: 0;
		width: 100%;
	}

	.player-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		padding: 2rem;
	}

	.top-margin {
		height: calc(40vh + 40vw);
		min-height: 0px;
		max-height: 800px;
	}

	/* Instructions area */
	.instructions {
		margin-top: 2rem;
		margin-bottom: 2rem;
		text-align: center;
	}
</style>
