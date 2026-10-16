/**
 * Client-safe entry point. Server utilities live in `./server` and must not
 * be imported from client components.
 */

export { createClient, firebase, getFirebaseAuth, toAppUser } from "./client";
export type { BrowserClient } from "./client";
export type { AppUser, AuthError } from "./auth-types";
