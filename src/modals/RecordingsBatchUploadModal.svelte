<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { Upload } from "lucide-svelte";
	import { toast } from "svelte-sonner";
	import {
		createUploadItems,
		processBatchUpload,
		validateBatchFiles,
		type UploadItem,
	} from "@/api/batchUpload";
	import BatchUploadItem from "@/components/recording/BatchUploadItem.svelte";

	export let isOpen = false;

	const dispatch = createEventDispatcher();

	let fileInput: HTMLInputElement;
	let uploadItems: UploadItem[] = [];
	let isUploading = false;
	let dragOver = false;

	$: if (!isOpen) {
		resetForm();
	}

	function resetForm() {
		uploadItems = [];
		if (fileInput) fileInput.value = "";
		isUploading = false;
		dragOver = false;
	}

	function handleClose() {
		if (isUploading) {
			if (!confirm("Uppladdning pågår. Är du säker på att du vill avbryta?")) {
				return;
			}
		}
		isOpen = false;
		dispatch("close");
	}

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files) {
			await addFiles(Array.from(input.files));
		}
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;

		if (event.dataTransfer?.files) {
			await addFiles(Array.from(event.dataTransfer.files));
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
	}

	async function addFiles(files: File[]) {
		const { valid, invalid } = validateBatchFiles(files);

		if (invalid.length > 0) {
			const reasons = invalid.map((f) => `${f.file.name}: ${f.reason}`).join("\n");
			toast.error("Vissa filer kunde inte läggas till", {
				description: reasons,
			});
		}

		if (valid.length === 0) {
			return;
		}

		const newItems = await createUploadItems(valid);
		uploadItems = [...uploadItems, ...newItems];
	}

	function handleItemRemove(event: CustomEvent<{ id: string }>) {
		uploadItems = uploadItems.filter((item) => item.id !== event.detail.id);
	}

	function handleItemUpdate(event: CustomEvent<{ id: string; field: string; value: any }>) {
		const { id, field, value } = event.detail;
		uploadItems = uploadItems.map((item) =>
			item.id === id ? { ...item, [field]: value } : item
		);
	}

	async function startUpload() {
		if (uploadItems.length === 0) {
			toast.error("Inga filer att ladda upp");
			return;
		}

		isUploading = true;

		const result = await processBatchUpload(
			uploadItems,
			(itemId, progress) => {
				// Update progress for item
				uploadItems = uploadItems.map((item) =>
					item.id === itemId
						? { ...item, status: "uploading", progress }
						: item
				);
			},
			(uploadResult) => {
				// Update status based on result
				uploadItems = uploadItems.map((item) =>
					item.id === uploadResult.id
						? {
								...item,
								status: uploadResult.success ? "success" : "error",
								error: uploadResult.error,
								progress: uploadResult.success ? 100 : 0,
						  }
						: item
				);
			}
		);

		isUploading = false;

		if (result.successCount > 0) {
			toast.success(
				`${result.successCount} inspelning${result.successCount === 1 ? "" : "ar"} uppladdade`
			);
			dispatch("updated");
		}

		if (result.errorCount > 0) {
			toast.error(
				`${result.errorCount} uppladdning${result.errorCount === 1 ? "" : "ar"} misslyckades`
			);
		}

		// Remove successful items after a delay
		if (result.successCount > 0) {
			setTimeout(() => {
				uploadItems = uploadItems.filter((item) => item.status !== "success");
				if (uploadItems.length === 0) {
					handleClose();
				}
			}, 2000);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Escape" && isOpen && !isUploading) {
			handleClose();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="modal" class:is-active={isOpen}>
	<div
		class="modal-background"
		on:click={handleClose}
		on:keypress={handleClose}
		role="button"
		tabindex="-1"
		aria-label="Close modal"
	></div>
	<div class="modal-card">
		<header class="modal-card-head">
			<p class="modal-card-title">
				<span class="icon">
					<Upload />
				</span>
				<span>Ladda upp flera inspelningar</span>
			</p>
			<button class="delete" aria-label="close" on:click={handleClose} disabled={isUploading}></button>
		</header>
		<section class="modal-card-body">
			<!-- File Drop Zone -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="drop-zone"
				class:drag-over={dragOver}
				on:drop={handleDrop}
				on:dragover={handleDragOver}
				on:dragleave={handleDragLeave}
			>
				<input
					bind:this={fileInput}
					type="file"
					accept="audio/*"
					multiple
					on:change={handleFileSelect}
					class="file-input-hidden"
					disabled={isUploading}
				/>
				<div class="has-text-centered">
					<span class="icon is-large has-text-grey">
						<Upload size={48} />
					</span>
					<p class="title is-5">Dra och släpp ljudfiler här</p>
					<p class="subtitle is-6">eller</p>
					<button
						class="button is-primary"
						on:click={() => fileInput.click()}
						disabled={isUploading}
					>
						Välj filer
					</button>
					<p class="help mt-3">Alla ljudformat stöds, max 50MB per fil</p>
				</div>
			</div>

			<!-- Upload Items List -->
			{#if uploadItems.length > 0}
				<div class="upload-items mt-5">
					<h4 class="title is-6">Filer att ladda upp ({uploadItems.length})</h4>

					<div class="upload-items-container">
						{#each uploadItems as item (item.id)}
							<BatchUploadItem
								{...item}
								disabled={isUploading}
								on:remove={handleItemRemove}
								on:update={handleItemUpdate}
							/>
						{/each}
					</div>
				</div>
			{/if}
		</section>
		<footer class="modal-card-foot">
			<button
				class="button is-primary"
				on:click={startUpload}
				disabled={isUploading || uploadItems.length === 0}
				class:is-loading={isUploading}
			>
				Ladda upp alla
			</button>
			<button class="button" on:click={handleClose} disabled={isUploading}>
				{uploadItems.some((item) => item.status === "success") ? "Stäng" : "Avbryt"}
			</button>
		</footer>
	</div>
</div>

<style>
	.modal-card {
		width: 90%;
		max-width: 900px;
		max-height: 90vh;
	}

	.modal-card-body {
		max-height: calc(90vh - 200px);
		overflow-y: auto;
	}

	.drop-zone {
		border: 2px dashed #dbdbdb;
		border-radius: 4px;
		padding: 3rem;
		text-align: center;
		transition: all 0.2s;
		cursor: pointer;
		position: relative;
	}

	.drop-zone:hover {
		border-color: #3273dc;
		background-color: #f5f5f5;
	}

	.drop-zone.drag-over {
		border-color: #3273dc;
		background-color: #e8f0fe;
		transform: scale(1.02);
	}

	.file-input-hidden {
		position: absolute;
		width: 0;
		height: 0;
		opacity: 0;
		pointer-events: none;
	}

	.upload-items-container {
		max-height: 400px;
		overflow-y: auto;
	}
</style>
