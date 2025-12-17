<script>
	import { Upload, Radio, User as UserIcon } from "lucide-svelte";
	import UploadForm from "@/components/UploadForm.svelte";
	import AccountForm from "@/components/AccountForm.svelte";
	import Layout from "@/components/Layout.svelte";

	let showUploadForm = false;
	let showSignInModal = false;
</script>

<Layout>
	<div class="box">
		<div class="has-text-centered mb-5">
			<img src="/ur.png" alt="UR Logo" style="max-height: 100px; width: auto;" />
		</div>
		<div class="content is-large has-text-left">
			<h3 class="title is-4 has-text-centered mb-5 has-text-danger">
				<span class="icon">
					<Radio />
				</span>
				Uddebo Radio sänder på julafton!
			</h3>
			<p>
				Vi sänder här på <strong>radio.uddebo.se kl 11 på julafton</strong>. Programmet sätts ihop
				av intervjuer, musik, sagor, julhälsningar och annat innehåll skapat av dig och andra
				Uddebobor!
			</p>

			<div class="notification is-info is-light is-rounded">
				<h3 class="title is-4 mb-3">
					Ladda upp ditt bidrag till <b class="has-text-danger">Julsändningen</b> ❄️🎄
				</h3>
				<p class="mb-3">
					Det är väldigt enklat att bidra med ditt innehåll till julshown. Ladda upp din inspelning
					direkt här på hemsidan.
				</p>
				<div class="has-text-centered">
					<button class="button is-info is-medium" on:click={() => (showUploadForm = true)}>
						<span class="icon">
							<Upload />
						</span>
						<span>Ladda upp</span>
					</button>
				</div>
			</div>

			<p class="mt-5">
				<strong>Andra sätt att bidra:</strong>
			</p>
			<ul>
				<li>Kom och låna mikrofon från Uddebo Makerspace på Väveriet</li>
				<li>Skicka din ljudfil direkt till oss på något vis</li>
			</ul>

			<hr />

			<p>
				<strong>Exempelvis, kontakta Viktor:</strong>
			</p>
			<ul>
				<li>E-post: <a href="mailto:viktor@lyresten.se">viktor@lyresten.se</a></li>
				<li>
					<a
						href="https://signal.me/#eu/2LVEiN8QuJZRw76g8No6y5MfO_IxfmU0llRdnZ5o5FP4_5MACkhGR5uv1VsuJESJ"
						>Signal</a
					>
				</li>
				<li><a href="https://www.facebook.com/viktorlyresten/">Facebook</a></li>
			</ul>

			<p class="mt-5">
				Med vänlig hälsning<br />
				<br />
				<strong>Uddebo Radio teamet</strong>
				<br />
				<button class="button is-small" on:click={() => (showSignInModal = true)}>
					<span class="icon">
						<UserIcon size={14} />
					</span>
					<span>Logga in</span>
				</button>
			</p>
		</div>
	</div>
</Layout>

{#if showUploadForm}
	<div class="modal is-active">
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="modal-background" on:click={() => (showUploadForm = false)}></div>
		<div class="modal-card" style="width: 90%; max-width: 900px;">
			<header class="modal-card-head">
				<button class="delete" aria-label="close" on:click={() => (showUploadForm = false)}
				></button>
			</header>
			<section class="modal-card-body">
				<UploadForm />
			</section>
		</div>
	</div>
{/if}

{#if showSignInModal}
	<AccountForm
		redirectTo="#/admin"
		on:success={() => (showSignInModal = false)}
		on:close={() => (showSignInModal = false)}
	/>
{/if}

<style>
	.notification {
		margin: 2rem 0;
	}

	.modal-card-body {
		overflow-y: auto;
		max-height: calc(100vh - 200px);
	}
</style>
