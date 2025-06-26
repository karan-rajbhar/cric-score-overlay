/**
 * SUPABASE SERVER ACTIONS
 * 
 * Server actions that interact with Supabase.
 * These are safe to call from client components but execute server-side.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServerClient } from './server';

/**
 * Schema for user profile updates
 */
const updateProfileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(100),
  avatar_url: z.string().url().optional().or(z.literal('')),
});

/**
 * Updates user profile
 * 
 * @param formData - Form data from client
 */
export async function updateProfile(formData: FormData) {
  try {
    const supabase = createServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Validate input
    const validatedData = updateProfileSchema.parse({
      full_name: formData.get('full_name'),
      avatar_url: formData.get('avatar_url'),
    });

    // Update profile
    const { error } = await supabase
      .from('profiles')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    revalidatePath('/dashboard');
    return { success: true, message: 'Profile updated successfully' };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        message: 'Validation error', 
        errors: error.flatten().fieldErrors 
      };
    }
    
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'An unexpected error occurred' 
    };
  }
}

/**
 * Sign out user
 */
export async function signOut() {
  try {
    const supabase = createServerClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Sign out error:', error);
  }
  
  redirect('/auth/login');
} 