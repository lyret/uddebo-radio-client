<script lang="ts">
	import { Upload, Music, Image, ChevronDown, ChevronUp, Info } from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import { supabase } from "@/api";
	import { getAllSwedishRecordingTypes } from "@/api/lang";
	import type { RecordingType } from "@/api/supabase/types";
	import { getFilenameWithDate } from "@/api/utils/filename";

	let uploading = false;
	let selectedFile: File | null = null;
	let selectedCoverFile: File | null = null;
	let title = "";
	let author = "";
	let description = "";
	let type: RecordingType = "unknown";
	let link_out_url = "";
	let fileInput: HTMLInputElement;
	let coverFileInput: HTMLInputElement;
	let showOptionalFields = false;

	const recordingTypes = getAllSwedishRecordingTypes();

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			// Check if it's an audio file
			if (!file.type.startsWith("audio/")) {
				toast.error("Ogiltig filtyp", {
					description: "Vänligen välj en ljudfil (mp3, wav, m4a, etc.)",
				});
				return;
			}

			// Check file size (limit to 50MB)
			if (file.size > 50 * 1024 * 1024) {
				toast.error("Filen är för stor", {
					description: "Vänligen välj en fil mindre än 50MB",
				});
				return;
			}

			selectedFile = file;

			// Auto-fill title from filename if not already set
			if (!title) {
				const filename = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
				title = filename;
			}
		}
	}

	function handleCoverFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			// Check if it's an image file
			if (!file.type.startsWith("image/")) {
				toast.error("Ogiltig filtyp", {
					description: "Vänligen välj en bildfil (jpg, png, etc.)",
				});
				return;
			}

			// Check file size (limit to 5MB for images)
			if (file.size > 5 * 1024 * 1024) {
				toast.error("Bilden är för stor", {
					description: "Vänligen välj en bild mindre än 5MB",
				});
				return;
			}

			selectedCoverFile = file;
		}
	}

	function removeFile() {
		selectedFile = null;
		if (fileInput) {
			fileInput.value = "";
		}
	}

	function removeCoverFile() {
		selectedCoverFile = null;
		if (coverFileInput) {
			coverFileInput.value = "";
		}
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
			// Check if user is authenticated (optional)
			const {
				data: { user },
			} = await supabase.auth.getUser();

			// Upload audio file to storage
			const fileExt = selectedFile.name.split(".").pop();
			const userFolder = user?.id || "anonymous";
			const timestamp = Date.now();
			const fileName = `${userFolder}/${timestamp}.${fileExt}`;

			const { error: uploadError } = await supabase.storage
				.from("recordings")
				.upload(fileName, selectedFile);

			if (uploadError) {
				console.error("uploadError:", uploadError);
				throw uploadError;
			}

			// Get public URL for audio
			const {
				data: { publicUrl },
			} = supabase.storage.from("recordings").getPublicUrl(fileName);

			// Create audio element to get duration
			const audio = new Audio();
			audio.src = URL.createObjectURL(selectedFile);

			await new Promise((resolve) => {
				audio.addEventListener("loadedmetadata", resolve);
				audio.load();
			});

			const duration = Math.floor(audio.duration);

			// Upload cover image if provided
			let coverUrl = null;
			if (selectedCoverFile) {
				const coverExt = selectedCoverFile.name.split(".").pop();
				const coverFileName = `${userFolder}/covers/${timestamp}.${coverExt}`;

				const { error: coverUploadError } = await supabase.storage
					.from("recordings")
					.upload(coverFileName, selectedCoverFile);

				if (coverUploadError) {
					console.error("Cover upload error:", coverUploadError);
					// Don't fail the entire upload if cover fails
					toast.warning("Omslagsbilden kunde inte laddas upp", {
						description: "Inspelningen laddades upp utan omslag",
					});
				} else {
					const { data: coverUrlData } = supabase.storage
						.from("recordings")
						.getPublicUrl(coverFileName);
					coverUrl = coverUrlData.publicUrl;
				}
			}

			// Save recording metadata to database
			const uploadedAt = new Date().toISOString();
			const recordingData = {
				title: title.trim(),
				author: author.trim() || null,
				description: description.trim() || null,
				type: type,
				link_out_url: link_out_url.trim() || null,
				cover_url: coverUrl,
				file_url: publicUrl,
				file_size: selectedFile.size,
				duration,
				uploaded_by: user?.id || null,
				uploaded_at: uploadedAt,
				uploaded_filename: getFilenameWithDate(selectedFile),
				edited_at: uploadedAt,
				edited_by: user?.id || null,
			};

			const { error: dbError } = await supabase.from("recordings").insert(recordingData);

			if (dbError) throw dbError;

			toast.success("Uppladdningen lyckades!", {
				description: "Din inspelning har lagts till i spellistan och kommer snart att granskas",
			});

			// Reset form
			selectedFile = null;
			selectedCoverFile = null;
			title = "";
			author = "";
			description = "";
			type = "unknown";
			link_out_url = "";
			showOptionalFields = false;

			// Reset file inputs
			if (fileInput) fileInput.value = "";
			if (coverFileInput) coverFileInput.value = "";
		} catch (error) {
			console.error("Upload error:", error);
			toast.error("Uppladdningen misslyckades", {
				description: "Ett fel uppstod när din inspelning laddades upp. Försök igen senare.",
			});
		} finally {
			uploading = false;
		}
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	}
</script>

<div class="container">
	<h3 class="title is-4 has-text-centered">Ladda upp inspelning</h3>
	<p class="subtitle is-6 has-text-centered mb-5">
		Dela din musik eller ljudinspelning med Uddebo Radio
	</p>

	<div class="notification is-info is-light">
		<div class="content">
			<p>
				<strong>Välkommen!</strong> Här kan du ladda upp din egen musik eller andra ljudinspelningar
				till Uddebo Radio. Alla uppladdningar granskas innan de spelas i radion.
			</p>
		</div>
	</div>

	<form on:submit|preventDefault={handleUpload}>
		<!-- File Upload -->
		<div class="field">
			<label class="label">
				Ljudfil *
				<span class="has-text-weight-normal has-text-grey"> (MP3, WAV, M4A, max 50MB) </span>
			</label>
			<div class="file is-boxed is-centered">
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
					<button type="button" class="delete" on:click={removeFile} disabled={uploading}
					></button>
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
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Title -->
		<div class="field">
			<label class="label" for="title">
				Titel *
				<span class="has-text-weight-normal has-text-grey">
					(Namnet på låten eller inspelningen)
				</span>
			</label>
			<div class="control">
				<input
					id="title"
					class="input"
					type="text"
					bind:value={title}
					placeholder="T.ex. 'Min fina låt' eller 'Intervju med..'"
					required
					disabled={uploading}
				/>
			</div>
		</div>

		<!-- Type -->
		<div class="field">
			<label class="label" for="type"> Typ av inspelning * </label>
			<div class="control">
				<div class="select is-fullwidth">
					<select id="type" bind:value={type} disabled={uploading}>
						{#each recordingTypes as recordingType}
							<option value={recordingType.value}>
								{recordingType.label}
							</option>
						{/each}
					</select>
				</div>
			</div>
			<p class="help">Välj den kategori som bäst beskriver din inspelning</p>
		</div>

		<!-- Artist/Author -->
		<div class="field">
			<label class="label" for="author">
				Artist/Upphovsperson
				<span class="has-text-weight-normal has-text-grey">
					(Vem har skapat eller framför inspelningen?)
				</span>
			</label>
			<div class="control">
				<input
					id="author"
					class="input"
					type="text"
					bind:value={author}
					placeholder="T.ex. artistnamn, bandnamn eller ditt namn"
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
				<span>
					{showOptionalFields ? "Dölj" : "Visa"} fler alternativ
				</span>
			</button>
		</div>

		{#if showOptionalFields}
			<div class="box has-background-light">
				<!-- Description -->
				<div class="field">
					<label class="label" for="description">
						Beskrivning
						<span class="has-text-weight-normal has-text-grey">
							(Berätta mer om inspelningen)
						</span>
					</label>
					<div class="control">
						<textarea
							id="description"
							class="textarea"
							bind:value={description}
							placeholder="T.ex. inspelningsår, medverkande, bakgrund eller annan information som kan vara intressant för lyssnarna"
							rows="3"
							disabled={uploading}
						></textarea>
					</div>
				</div>

				<!-- Cover Image -->
				<div class="field">
					<label class="label">
						Omslagsbild
						<span class="has-text-weight-normal has-text-grey"> (JPG, PNG, max 5MB) </span>
					</label>
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
					<p class="help">En omslagsbild gör din inspelning mer synlig och professionell</p>
				</div>

				<!-- External Link -->
				<div class="field">
					<label class="label" for="link">
						Extern länk
						<span class="has-text-weight-normal has-text-grey">
							(Hemsida, Spotify, YouTube etc.)
						</span>
					</label>
					<div class="control">
						<input
							id="link"
							class="input"
							type="url"
							bind:value={link_out_url}
							placeholder="https://..."
							disabled={uploading}
						/>
					</div>
					<p class="help">Länk där lyssnare kan hitta mer av din musik eller information</p>
				</div>
			</div>
		{/if}

		<!-- Upload Button -->
		<div class="field mt-5">
			<div class="control">
				<button
					type="submit"
					class="button is-primary is-fullwidth is-medium"
					disabled={!selectedFile || !title.trim() || uploading}
					class:is-loading={uploading}
				>
					<span class="icon">
						<Upload />
					</span>
					<span>Ladda upp inspelning</span>
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
				<li>Du måste ha rätt att dela innehållet du laddar upp</li>
				<li>Alla uppladdningar granskas innan de spelas i radion</li>
				<li>Innehållet blir offentligt tillgängligt via Uddebo Radio</li>
				<li>Inget konto krävs - alla kan ladda upp!</li>
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
