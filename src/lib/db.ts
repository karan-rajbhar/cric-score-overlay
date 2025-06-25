import { createClient } from '@supabase/supabase-js'
import { env } from "~/env.js";

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// For server-side operations, you might want a service role client
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)