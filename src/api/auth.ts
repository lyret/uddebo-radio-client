import type { User } from "./supabase";
import { writable, derived } from "svelte/store";
import { supabase } from "./supabase";

export const authenticationStore = _createAuthStore();

/**
 * Derived store to check if user is authenticated
 */
export const isAuthenticated = derived(authenticationStore, ($auth) => !!$auth);

/**
 * Derived store to check if user is admin, as of now all users are admins
 */
export const isAdmin = derived(isAuthenticated, ($isAuthenticated) => $isAuthenticated);

/**
 * Auth store for managing user authentication state
 */
function _createAuthStore() {
	const { subscribe, set } = writable<User | null>(null);

	return {
		subscribe,
		/**
		 * Initialize the auth store and set up listeners
		 */
		initialize: async () => {
			// Get initial session
			const {
				data: { user },
			} = await supabase.auth.getUser();
			set(user);

			// Listen for auth changes
			const {
				data: { subscription },
			} = supabase.auth.onAuthStateChange((_event, session) => {
				set(session?.user ?? null);
			});

			// Return cleanup function
			return () => {
				subscription.unsubscribe();
			};
		},
		/**
		 * Sign in with email and password
		 */
		signIn: async (email: string, password: string) => {
			const { error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});
			return { error };
		},
		/**
		 * Sign out the current user
		 */
		signOut: async () => {
			const { error } = await supabase.auth.signOut();
			return { error };
		},
	};
}
