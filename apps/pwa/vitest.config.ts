import { defineConfig } from 'vitest/config'

// Kept apart from vite.config.ts so tests do not load the PWA plugin.
export default defineConfig({
  // Tests always run in demo mode, even when .env.local points at a real Supabase project.
  envDir: false,
  test: { environment: 'node' },
})
