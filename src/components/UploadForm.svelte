<script lang="ts">
	import { Upload, Music, Image, ChevronDown, ChevronUp, Info } from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import {
		uploadAudioFile,
		uploadCoverImage,
		createRecording,
		validateImageFile,
		formatFileSize,
		getFilenameWithDate,
	} from "@/api";
	import { needsAudioConversion } from "@/api/audioConverter";
	import { getAllSwedishRecordingTypes } from "@/api/lang";
	import { supabase } from "@/api/supabase";
	import type { RecordingType } from "@/api/supabase/types";

	let uploading = false;
	let selectedFile: File | null = null;
	let selectedCoverFile: File | null = null;
	let title = "";
	let author = "";
	let description = "";
	let type: RecordingType = "unknown";
	let linkOutUrl = "";
	let fileInput: HTMLInputElement;
	let coverFileInput: HTMLInputElement;
	let showOptionalFields = false;

	const recordingTypes = getAllSwedishRecordingTypes();

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			selectedFile = file;
			// Auto-fill title from filename if empty
			if (!title) {
				title = file.name.replace(/\.[^/.]+$/, "");
			}
		}
	}

	function handleCoverFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			const validation = validateImageFile(file);
			if (!validation.valid) {
				toast.error("Ogiltig fil", {
					description: validation.error,
				});
				return;
			}
			selectedCoverFile = file;
		}
	}

	function removeFile() {
		selectedFile = null;
		if (fileInput) fileInput.value = "";
	}

	function removeCoverFile() {
		selectedCoverFile = null;
		if (coverFileInput) coverFileInput.value = "";
	}

	async function handleUpload() {
		if (!selectedFile || !title.trim()) {
			toast.error("Information saknas", {
				description: "Vänligen välj en ljudfil och ange en titel",
			});
			return;
		}

		uploading = true;

		try {
			// Get current user
			const {
				data: { user },
			} = await supabase.auth.getUser();

			// Upload audio file
			const audioResult = await uploadAudioFile({
				file: selectedFile,
				bucket: "recordings",
				showProgress: true,
				autoConvert: true,
				maxSizeMB: 50,
			});

			// Upload cover if provided
			let coverUrl = null;
			if (selectedCoverFile) {
				try {
					coverUrl = await uploadCoverImage(selectedCoverFile, "cover_images", "");
				} catch (error) {
					console.error("Cover upload error:", error);
					toast.warning("Omslagsbilden kunde inte laddas upp");
				}
			}

			// Create recording in database
			const now = new Date().toISOString();
			const { data, error } = await createRecording({
				title: title.trim(),
				author: author.trim() || null,
				description: description.trim() || null,
				type,
				link_out_url: linkOutUrl.trim() || null,
				cover_url: coverUrl,
				file_url: audioResult.url,
				file_size: audioResult.file.size,
				duration: audioResult.duration || 0,
				uploaded_filename:
					audioResult.wasConverted && audioResult.originalFile
						? getFilenameWithDate(new File([new Blob()], audioResult.originalFile.name))
						: getFilenameWithDate(audioResult.file),
				uploaded_by: user?.id || null,
				uploaded_at: now,
				edited_at: now,
				edited_by: user?.id || null,
				captions_url: null,
				okey_at: null,
				okey_by: null,
			});

			if (error) throw error;

			// Success
			const message = audioResult.wasConverted
				? "Din inspelning konverterades till MP3 och har lagts till"
				: "Din inspelning har lagts till och kommer snart att granskas";

			toast.success("Uppladdningen lyckades!", {
				description: message,
			});

			// Reset form
			resetForm();
		} catch (error) {
			console.error("Upload error:", error);
			toast.error("Uppladdningen misslyckades", {
				description: error instanceof Error ? error.message : "Ett fel uppstod",
			});
		} finally {
			uploading = false;
		}
	}

	function resetForm() {
		selectedFile = null;
		selectedCoverFile = null;
		title = "";
		author = "";
		description = "";
		type = "unknown";
		linkOutUrl = "";
		showOptionalFields = false;
		if (fileInput) fileInput.value = "";
		if (coverFileInput) coverFileInput.value = "";
	}
</script>

<div class="container">
	<h3 class="title is-4 has-text-centered">Ladda upp en inspelning</h3>
	<p class="subtitle is-6 has-text-centered mb-5">
		Dela din musik eller ljudinspelningar med Uddebo Radio
	</p>

	<form on:submit|preventDefault={handleUpload}>
		<!-- File Upload -->
		<div class="field">
			<!-- svelte-ignore a11y-label-has-associated-control -->
			<label class="label">
				Ljudfil *
				<span class="has-text-weight-normal has-text-grey">(Alla ljudformat, max 50MB)</span>
			</label>
			<div class="file is-boxed is-centered is-fullwidth has-text-centered">
				<label class="file-label">
					<input
						bind:this={fileInput}
						class="file-input"
						type="file"
						accept="audio/*"
						on:change={handleFileSelect}
						disabled={uploading}
					/>
					<span class="file-cta">
						<span class="file-icon">
							<Upload />
						</span>
						<span class="file-label">Välj en ljudfil...</span>
					</span>
				</label>
			</div>
			{#if selectedFile}
				<div class="notification is-light mt-3">
					<button type="button" class="delete" on:click={removeFile} disabled={uploading}></button>
					<div class="media">
						<div class="media-left">
							<span class="icon has-text-primary">
								<Music size={24} />
							</span>
						</div>
						<div class="media-content">
							<strong>{selectedFile.name}</strong>
							<br />
							<small>{formatFileSize(selectedFile.size)}</small>
							{#if needsAudioConversion(selectedFile)}
								<span class="tag is-info is-small ml-2">Konverteras till MP3</span>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Title -->
		<div class="field">
			<label class="label" for="title">Titel *</label>
			<div class="control">
				<input
					id="title"
					class="input"
					type="text"
					bind:value={title}
					placeholder="T.ex. 'Min fina låt'"
					required
					disabled={uploading}
				/>
			</div>
		</div>

		<!-- Type -->
		<div class="field">
			<label class="label" for="type">Typ av inspelning *</label>
			<div class="control">
				<div class="select is-fullwidth">
					<select id="type" bind:value={type} disabled={uploading}>
						{#each recordingTypes as recordingType}
							<option value={recordingType.value}>{recordingType.label}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>

		<!-- Artist -->
		<div class="field">
			<label class="label" for="author">Artist/Upphovsperson</label>
			<div class="control">
				<input
					id="author"
					class="input"
					type="text"
					bind:value={author}
					placeholder="Artistnamn, bandnamn eller ditt namn"
					disabled={uploading}
				/>
			</div>
		</div>

		<!-- Optional fields toggle -->
		<div class="field mt-5">
			<button
				type="button"
				class="button is-text is-fullwidth"
				on:click={() => (showOptionalFields = !showOptionalFields)}
				disabled={uploading}
			>
				<span class="icon">
					{#if showOptionalFields}
						<ChevronUp />
					{:else}
						<ChevronDown />
					{/if}
				</span>
				<span>{showOptionalFields ? "Dölj" : "Visa"} fler alternativ</span>
			</button>
		</div>

		{#if showOptionalFields}
			<div class="box has-background-light">
				<!-- Description -->
				<div class="field">
					<label class="label" for="description">Beskrivning</label>
					<div class="control">
						<textarea
							id="description"
							class="textarea"
							bind:value={description}
							placeholder="Berätta mer om inspelningen"
							rows="3"
							disabled={uploading}
						></textarea>
					</div>
				</div>

				<!-- Cover Image -->
				<div class="field">
					<!-- svelte-ignore a11y-label-has-associated-control -->
					<label class="label">Omslagsbild</label>
					<div class="file has-name is-fullwidth">
						<label class="file-label">
							<input
								bind:this={coverFileInput}
								class="file-input"
								type="file"
								accept="image/*"
								on:change={handleCoverFileSelect}
								disabled={uploading}
							/>
							<span class="file-cta">
								<span class="file-icon">
									<Image />
								</span>
								<span class="file-label">Välj bild...</span>
							</span>
							<span class="file-name">
								{selectedCoverFile ? selectedCoverFile.name : "Ingen bild vald"}
							</span>
						</label>
					</div>
					{#if selectedCoverFile}
						<button
							type="button"
							class="button is-small is-text mt-2"
							on:click={removeCoverFile}
							disabled={uploading}
						>
							Ta bort bild
						</button>
					{/if}
				</div>

				<!-- External Link -->
				<div class="field">
					<label class="label" for="link">Extern länk</label>
					<div class="control">
						<input
							id="link"
							class="input"
							type="url"
							bind:value={linkOutUrl}
							placeholder="https://..."
							disabled={uploading}
						/>
					</div>
					<p class="help">Länk till hemsida, Spotify eller YouTube</p>
				</div>
			</div>
		{/if}

		<!-- Submit Button -->
		<div class="field mt-5">
			<div class="control">
				<button
					type="submit"
					class="button is-primary is-fullwidth is-medium"
					disabled={!selectedFile || !title.trim() || uploading}
					class:is-danger={(selectedFile && title.trim()) || uploading}
					class:is-loading={uploading}
				>
					<span class="icon">
						<Upload />
					</span>
					<span>Ladda upp</span>
				</button>
			</div>
		</div>
	</form>

	<div class="notification is-warning is-light mt-5">
		<div class="content has-text-centered">
			<p class="mb-2">
				<span class="icon has-text-warning">
					<Info />
				</span>
				<strong>Viktigt att veta:</strong>
			</p>
			<ul class="has-text-left" style="max-width: 500px; margin: 0 auto;">
				<li>Du måste ha rätt att dela innehållet</li>
				<li>Alla uppladdningar granskas innan de spelas</li>
				<li>
					Ljudfiler konverteras automatiskt till MP3, lämna webbläsaren öppen tills avkodningen är
					klar
				</li>
			</ul>
		</div>
	</div>
</div>

<style>
	.container {
		max-width: 800px;
		margin: 0 auto;
	}

	.file.is-fullwidth .file-name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.notification ul {
		margin-left: 1.5em;
	}

	.notification ul li {
		margin-bottom: 0.5em;
	}
</style>
