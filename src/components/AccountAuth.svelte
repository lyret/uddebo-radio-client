<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { supabase } from "@/integrations/supabase/client";
	import type { User } from "@supabase/supabase-js";
	import { toast } from "svelte-sonner";
	import { LogOut, User as UserIcon } from "lucide-svelte";

	let user: User | null = null;
	let loading = false;
	let email = "";
	let password = "";
	let activeTab = "signin";
	let subscription: { unsubscribe: () => void };

	onMount(() => {
		// Set up auth state listener
		const authListener = supabase.auth.onAuthStateChange((_event, _session) => {
			user = _session?.user ?? null;
		});
		subscription = authListener.data.subscription;

		// Check for existing session
		supabase.auth.getSession().then(({ data: { session: _session } }) => {
			user = _session?.user ?? null;
		});
	});

	onDestroy(() => {
		subscription?.unsubscribe();
	});

	async function signUp(email: string, password: string) {
		const redirectUrl = `${window.location.origin}/`;

		const { error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: redirectUrl,
			},
		});
		return { error };
	}

	async function signIn(email: string, password: string) {
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		return { error };
	}

	async function signOut() {
		const { error } = await supabase.auth.signOut();
		if (error) {
			toast.error("Error signing out: " + error.message);
		} else {
			toast.success("Signed out successfully");
		}
	}

	async function handleSubmit(isSignUp: boolean) {
		if (!email || !password) {
			toast.error("Please fill in all fields");
			return;
		}

		loading = true;
		try {
			const { error } = isSignUp ? await signUp(email, password) : await signIn(email, password);

			if (error) {
				if (error.message.includes("User already registered")) {
					toast.error("This email is already registered. Please sign in instead.");
				} else if (error.message.includes("Invalid login credentials")) {
					toast.error("Invalid email or password. Please check your credentials.");
				} else {
					toast.error(error.message);
				}
			} else {
				if (isSignUp) {
					toast.success("Account created! Please check your email to confirm your account.");
				} else {
					toast.success("Signed in successfully!");
				}
				email = "";
				password = "";
			}
		} catch (error) {
			toast.error("An unexpected error occurred");
		} finally {
			loading = false;
		}
	}
</script>

<div>
	{#if user}
		<div class="message is-primary">
			<div class="message-header">
				<p>
					<span class="icon">
						<UserIcon />
					</span>
					<span>Welcome back!</span>
				</p>
			</div>
			<div class="message-body">
				<p class="mb-2">You're signed in and ready to upload recordings</p>
				<p class="mb-4">
					<strong>{user.email}</strong>
					<br />
					<small>Account created: {new Date(user.created_at).toLocaleDateString()}</small>
				</p>
				<button class="button is-fullwidth" on:click={signOut}>
					<span class="icon">
						<LogOut size={16} />
					</span>
					<span>Sign Out</span>
				</button>
			</div>
		</div>
	{:else}
		<div>
			<h3 class="title is-5">Account (Optional)</h3>
			<p class="subtitle is-6">
				Create an account to manage your uploads, or upload anonymously without signing up
			</p>

			<div class="tabs is-centered">
				<ul>
					<li class:is-active={activeTab === "signin"}>
						<a href="#signin" on:click|preventDefault={() => (activeTab = "signin")}>Sign In</a>
					</li>
					<li class:is-active={activeTab === "signup"}>
						<a href="#signup" on:click|preventDefault={() => (activeTab = "signup")}>Sign Up</a>
					</li>
				</ul>
			</div>

			<form on:submit|preventDefault={() => handleSubmit(activeTab === "signup")}>
				<div class="field">
					<label class="label" for="{activeTab}-email">Email</label>
					<div class="control">
						<input
							id="{activeTab}-email"
							class="input"
							type="email"
							bind:value={email}
							placeholder="Enter your email"
							disabled={loading}
							required
						/>
					</div>
				</div>

				<div class="field">
					<label class="label" for="{activeTab}-password">Password</label>
					<div class="control">
						<input
							id="{activeTab}-password"
							class="input"
							type="password"
							bind:value={password}
							placeholder={activeTab === "signup" ? "Create a password" : "Enter your password"}
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
							{activeTab === "signup" ? "Create Account" : "Sign In"}
						</button>
					</div>
				</div>
			</form>
		</div>
	{/if}
</div>
