<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { toast } from "svelte-sonner";
	import { authenticationStore } from "@/api";

	export let redirectTo: string | null = null;

	const dispatch = createEventDispatcher<{
		success: void;
		close: void;
	}>();

	let loading = false;
	let email = "";
	let password = "";

	/**
	 * Handles the sign-in process
	 */
	async function handleSubmit() {
		if (!email || !password) {
			toast.error("Vänligen fyll i alla fält");
			return;
		}

		loading = true;
		try {
			const { error } = await authenticationStore.signIn(email, password);

			if (error) {
				if (error.message?.includes("User already registered")) {
					toast.error("Den här e-postadressen är redan registrerad. Vänligen logga in istället.");
				} else if (error.message?.includes("Invalid login credentials")) {
					toast.error("Ogiltig e-post eller lösenord. Vänligen kontrollera dina uppgifter.");
				} else {
					toast.error(error.message || "Ett fel uppstod");
				}
			} else {
				toast.success("Välkommen in!");
				email = "";
				password = "";

				// Dispatch success event
				dispatch("success");

				// Handle redirect if specified
				if (redirectTo) {
					window.location.hash = redirectTo;
				}
			}
		} catch {
			toast.error("Ett oväntat fel uppstod");
		} finally {
			loading = false;
		}
	}

	/**
	 * Handles the close action
	 */
	function handleClose() {
		dispatch("close");
	}
</script>

<div class="modal is-active">
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="modal-background" on:click={handleClose}></div>
	<div class="modal-card" style="width: 90%; max-width: 500px;">
		<header class="modal-card-head">
			<p class="modal-card-title">Logga in</p>
			<button class="delete" aria-label="close" on:click={handleClose}></button>
		</header>
		<section class="modal-card-body">
			<form on:submit|preventDefault={handleSubmit}>
				<div class="field">
					<label class="label" for="account-email">E-post</label>
					<div class="control">
						<input
							id="account-email"
							class="input"
							type="email"
							bind:value={email}
							placeholder="Ange din e-postadress"
							disabled={loading}
							required
						/>
					</div>
				</div>

				<div class="field">
					<label class="label" for="account-password">Lösenord</label>
					<div class="control">
						<input
							id="account-password"
							class="input"
							type="password"
							bind:value={password}
							placeholder="Ange ditt lösenord"
							disabled={loading}
							required
						/>
					</div>
				</div>

				<div class="field">
					<div class="control">
						<button
							type="submit"
							class="button is-primary is-fullwidth"
							disabled={loading}
							class:is-loading={loading}
						>
							Logga in
						</button>
					</div>
				</div>
			</form>
		</section>
	</div>
</div>

<style>
	.modal-card-body {
		background: white;
	}
</style>
