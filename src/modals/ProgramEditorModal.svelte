<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { Radio } from "lucide-svelte";
	import type { BroadcastProgram } from "@/api";
	import ProgramInformationForm from "@/components/program/ProgramInformationForm.svelte";

	export let program: BroadcastProgram | null = null;
	export let isOpen = false;

	const dispatch = createEventDispatcher();

	// Form ref
	let formComponent: ProgramInformationForm;

	function handleClose() {
		isOpen = false;
		dispatch("close");
	}

	function handleSaved(event: CustomEvent<{ type: "create" | "update" }>) {
		dispatch("updated");
		// Close modal if creating new program
		if (event.detail.type === "create") {
			handleClose();
		}
	}

	function handleUpdated() {
		dispatch("updated");
	}

	function handleDeleted() {
		dispatch("deleted");
		handleClose();
	}
</script>

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
					<Radio />
				</span>
				<span>{program ? "Redigera" : "Skapa"} sändningsprogram</span>
			</p>
			<button class="delete" aria-label="close" on:click={handleClose}></button>
		</header>
		<section class="modal-card-body">
			<ProgramInformationForm
				bind:this={formComponent}
				{program}
				on:saved={handleSaved}
				on:updated={handleUpdated}
				on:deleted={handleDeleted}
			/>
		</section>
	</div>
</div>

<style>
	.modal-card {
		width: 90%;
		max-width: 600px;
	}

	.modal-card-body {
		max-height: calc(100vh - 200px);
		overflow-y: auto;
	}
</style>
