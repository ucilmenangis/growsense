import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

/**
 * Null until .env.local has the project URL and publishable key; the dashboard then runs as a demo.
 * The login token is kept per tab, so it is gone when a shared Puskesmas computer closes the tab.
 */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { storage: sessionStorage } }) : null
