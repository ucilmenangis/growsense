import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Cursor, Remote, RemoteRow } from './sync'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

/** Null until .env.local has the project URL and publishable key. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export function supabaseRemote(client: SupabaseClient): Remote {
  return {
    async upsert(table, rows) {
      const { error } = await client.from(table).upsert(rows)
      if (error) throw error
    },
    async pullSince(table, cursor: Cursor | null, limit) {
      let query = client.from(table).select('*').order('updated_at').order('id').limit(limit)
      if (cursor) {
        query = query.or(`updated_at.gt.${cursor.at},and(updated_at.eq.${cursor.at},id.gt.${cursor.id})`)
      }
      const { data, error } = await query
      if (error) throw error
      return data as RemoteRow[]
    },
  }
}
