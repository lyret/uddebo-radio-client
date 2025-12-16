<script lang="ts">
	import { toast } from "svelte-sonner";
	import { LogOut, User as UserIcon } from "lucide-svelte";
	import Layout from "@/components/Layout.svelte";
	import { authenticationStore } from "@/api";

	let loading = false;
	let email = "";
	let password = "";

	async function signInHandler() {
		const { error } = await authenticationStore.signIn(email, password);
		return error;
	}

	async function signOutHandler() {
		const { error } = await authenticationStore.signOut();
		if (error) {
			toast.error("Fel vid utloggning: " + error.message);
		} else {
			toast.success("Hej då!");
		}
	}

	async function handleSubmit() {
		if (!email || !password) {
			toast.error("Vänligen fyll i alla fält");
			return;
		}

		loading = true;
		try {
			const error = await signInHandler();

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
			}
		} catch {
			toast.error("Ett oväntat fel uppstod");
		} finally {
			loading = false;
		}
	}
</script>

<Layout>
	<div>
		{#if $authenticationStore}
			<div class="message is-success">
				<div class="message-header">
					<p>
						<span class="icon">
							<UserIcon />
						</span>
						<span>Du är inloggad</span>
					</p>
				</div>
				<div class="message-body">
					<p class="mb-2">
						Du är inloggad och har tillgång till att administrera inspelningar och program
					</p>
					<p class="mb-4">
						<strong>{$authenticationStore.email}</strong>
						<br />
						<small
							>Konto skapat: {new Date($authenticationStore.created_at).toLocaleDateString(
								"sv-SE"
							)}</small
						>
						<br />
						<small>Är administratör: <b>Ja</b></small>
					</p>
					<button class="button is-fullwidth" on:click={signOutHandler}>
						<span class="icon">
							<LogOut size={16} />
						</span>
						<span>Logga ut</span>
					</button>
				</div>
			</div>
		{:else}
			<div>
				<h3 class="title is-5">Logga in (frivilligt)</h3>
				<p class="subtitle is-6">
					Om du har ett konto för att hantera Uddebo Radio kan du logga in här, du kan också skicka
					in bidrag anonymt utan att registrera dig
				</p>

				<form on:submit|preventDefault={() => handleSubmit()}>
					<div class="field">
						<label class="label" for="email">E-post</label>
						<div class="control">
							<input
								id="email"
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
						<label class="label" for="password">Lösenord</label>
						<div class="control">
							<input
								id="password"
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
			</div>
		{/if}
	</div>
</Layout>
