/**
 * CLIENT-SIDE SUPABASE UTILITIES
 * 
 * This file only exports client-safe Supabase utilities.
 * Server-side utilities are in separate files to prevent accidental mixing.
 * 
 * Usage:
 * - Import from this file in client components
 * - Use createClient() for authenticated operations
 * - Never import server utilities in client components
 */

export { createClient, supabase } from './client'; 