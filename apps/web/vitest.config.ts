import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Tests always run in demo mode, even when .env.local points at a real Supabase project.
  envDir: false,
  test: { environment: 'node' },
})
