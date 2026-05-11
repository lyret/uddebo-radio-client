import type { User } from "./pb";
import { writable, derived } from "svelte/store";
import { pb } from "./pb";

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
			set((pb.authStore.model as User) ?? null);

			const unsubscribe = pb.authStore.onChange(() => {
				set((pb.authStore.model as User) ?? null);
			});

			return () => unsubscribe();
		},
		/**
		 * Sign in with email and password
		 */
		signIn: async (email: string, password: string) => {
			try {
				await pb.collection("users").authWithPassword(email, password);
				return { error: null };
			} catch (err) {
				return { error: err as Error };
			}
		},
		/**
		 * Sign out the current user
		 */
		signOut: async () => {
			try {
				pb.authStore.clear();
				return { error: null };
			} catch (err) {
				return { error: err as Error };
			}
		},
	};
}
