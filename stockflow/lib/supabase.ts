import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// This prevents the "supabaseKey is required" crash during build
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)