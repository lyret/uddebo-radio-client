<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { Play, Pause, Volume2, SkipForward, SkipBack } from "lucide-svelte";
	import { supabase } from "@/integrations/supabase/client";
	import { toast } from "svelte-sonner";

	interface Recording {
		id: string;
		title: string;
		artist: string | null;
		file_url: string;
		duration: number | null;
	}

	let isPlaying = false;
	let currentTime = 0;
	let duration = 0;
	let volume = 0.7;
	let recordings: Recording[] = [];
	let currentTrackIndex = 0;
	let loading = true;
	let audioElement: HTMLAudioElement;

	$: currentTrack = recordings[currentTrackIndex];

	onMount(() => {
		fetchRecordings();
	});

	onDestroy(() => {
		if (audioElement) {
			audioElement.pause();
		}
	});

	async function fetchRecordings() {
		try {
			const { data, error } = await supabase
				.from("recordings")
				.select("*")
				.eq("is_active", true)
				.order("created_at", { ascending: false });

			if (error) throw error;
			recordings = data || [];
		} catch (error) {
			toast.error("Error loading recordings", {
				description: "Failed to fetch the playlist",
			});
		} finally {
			loading = false;
		}
	}

	function togglePlayPause() {
		if (!audioElement || !currentTrack) return;

		if (isPlaying) {
			audioElement.pause();
		} else {
			audioElement.play();
		}
	}

	function nextTrack() {
		if (recordings.length === 0) return;
		currentTrackIndex = (currentTrackIndex + 1) % recordings.length;
	}

	function previousTrack() {
		if (recordings.length === 0) return;
		currentTrackIndex = currentTrackIndex === 0 ? recordings.length - 1 : currentTrackIndex - 1;
	}

	function handleSeek(event: Event) {
		const input = event.target as HTMLInputElement;
		if (audioElement) {
			audioElement.currentTime = parseFloat(input.value);
		}
	}

	function handleVolumeChange(event: Event) {
		const input = event.target as HTMLInputElement;
		volume = parseFloat(input.value);
		if (audioElement) {
			audioElement.volume = volume;
		}
	}

	function formatTime(time: number): string {
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	}

	function handleTimeUpdate() {
		currentTime = audioElement.currentTime;
	}

	function handleLoadedMetadata() {
		duration = audioElement.duration;
		audioElement.volume = volume;
	}

	function handleEnded() {
		nextTrack();
	}

	function handlePlay() {
		isPlaying = true;
	}

	function handlePause() {
		isPlaying = false;
	}

	// Handle track changes
	// // TODO: this is broken:
	$: if (audioElement && currentTrack) {
		console.log("here");
		audioElement.src = currentTrack.file_url;
		if (isPlaying) {
			audioElement.play();
		}
	}
</script>

{#if loading}
	<div class="has-text-centered p-6">
		<div class="button is-loading is-large is-ghost"></div>
		<p class="mt-4">Loading recordings...</p>
	</div>
{:else if recordings.length === 0}
	<div class="notification is-warning has-text-centered">
		<h3 class="title is-5">No recordings available</h3>
		<p>Upload some recordings to start the radio!</p>
	</div>
{:else}
	<div>
		<audio
			bind:this={audioElement}
			on:load={handleLoadedMetadata}
			on:timeupdate={handleTimeUpdate}
			on:ended={handleEnded}
			on:play={handlePlay}
			on:pause={handlePause}
		/>

		<!-- Track Info -->
		<div class="has-text-centered mb-5">
			<h2 class="title is-4">
				{currentTrack?.title || "No track selected"}
			</h2>
			{#if currentTrack?.artist}
				<p class="subtitle is-6">{currentTrack.artist}</p>
			{/if}
		</div>

		<!-- Progress Bar -->
		<div class="mb-5">
			<progress class="progress is-primary" value={currentTime} max={duration}></progress>
			<div class="columns is-mobile">
				<div class="column">
					<small>{formatTime(currentTime)}</small>
				</div>
				<div class="column has-text-right">
					<small>{formatTime(duration)}</small>
				</div>
			</div>
			<input
				type="range"
				min="0"
				max={duration}
				value={currentTime}
				on:input={handleSeek}
				class="slider is-fullwidth"
			/>
		</div>

		<!-- Controls -->
		<div class="buttons has-addons is-centered mb-5">
			<button class="button is-medium" on:click={previousTrack} disabled={recordings.length <= 1}>
				<span class="icon">
					<SkipBack size={20} />
				</span>
			</button>

			<button
				class="button is-primary is-medium is-rounded"
				on:click={togglePlayPause}
				disabled={!currentTrack}
			>
				<span class="icon is-large">
					{#if isPlaying}
						<Pause size={28} />
					{:else}
						<Play size={28} />
					{/if}
				</span>
			</button>

			<button class="button is-medium" on:click={nextTrack} disabled={recordings.length <= 1}>
				<span class="icon">
					<SkipForward size={20} />
				</span>
			</button>
		</div>

		<!-- Volume Control -->
		<div class="field is-horizontal">
			<div class="field-label is-small">
				<label class="label">
					<span class="icon">
						<Volume2 size={20} />
					</span>
				</label>
			</div>
			<div class="field-body">
				<div class="field">
					<input
						type="range"
						min="0"
						max="1"
						step="0.1"
						value={volume}
						on:input={handleVolumeChange}
						class="slider is-fullwidth"
					/>
				</div>
			</div>
		</div>

		<!-- Playlist Info -->
		<div class="has-text-centered">
			<small class="has-text-grey">
				Track {currentTrackIndex + 1} of {recordings.length}
			</small>
		</div>
	</div>
{/if}
