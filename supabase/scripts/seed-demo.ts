// Fills a Supabase project with the dashboard demo data and test accounts.
// Needs supabase/.secrets/service.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Safe to run again: rows are upserted by id, existing accounts keep their password.
// New passwords are written to supabase/.secrets/accounts.tsv and never printed.
import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { demoDataset, todayIso } from '@growsense/core'

const SECRETS = new URL('../.secrets/', import.meta.url)
process.loadEnvFile(new URL('service.env', SECRETS))
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .secrets/service.env')

// The service role key bypasses row level security. It stays in this script, never in an app.
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const data = demoDataset(todayIso())
const strip = <T extends object>(rows: T[]) =>
  rows.map((row) => {
    const copy: Record<string, unknown> = { ...row }
    for (const c of ['created_at', 'updated_at', 'created_by', 'recorded_by']) delete copy[c]
    return copy
  })

async function upsert(table: string, rows: object[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict: 'id' })
    if (error) throw new Error(`${table}: ${error.message}`)
  }
  console.log(`${table}: ${rows.length}`)
}

await upsert('puskesmas', [data.puskesmas])
await upsert(
  'posyandu',
  data.posyandu.map((p) => ({ ...p, puskesmas_id: data.puskesmas.id })),
)
await upsert('children', strip(data.children))
await upsert('measurements', strip(data.measurements))
await upsert('follow_ups', strip(data.followUps))

// Invented NIP and phone numbers. Kader log in with the phone (0811...), staff with the NIP.
const ACCOUNTS = [
  {
    email: '198001012010012001@staf.growsense.id',
    login: '198001012010012001',
    role: 'bidan',
    name: 'Bidan Demo',
    posyandu: null,
  },
  {
    email: '198501012015011001@staf.growsense.id',
    login: '198501012015011001',
    role: 'pemdes',
    name: 'Pemdes Demo',
    posyandu: null,
  },
  {
    email: '6281100000001@kader.growsense.id',
    login: '081100000001',
    role: 'kader',
    name: 'Kader Demo Satu',
    posyandu: 0,
  },
  {
    email: '6281100000002@kader.growsense.id',
    login: '081100000002',
    role: 'kader',
    name: 'Kader Demo Dua',
    posyandu: 1,
  },
] as const

const file = new URL('accounts.tsv', SECRETS)
const saved = existsSync(file) ? readFileSync(file, 'utf8') : 'role\tlogin\tpassword\n'
const lines = [saved.trimEnd()]

const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 })
if (listError) throw listError
for (const a of ACCOUNTS) {
  let user = list.users.find((u) => u.email === a.email)
  if (!user) {
    const password = randomBytes(9).toString('base64url')
    const { data: created, error } = await db.auth.admin.createUser({ email: a.email, password, email_confirm: true })
    if (error) throw new Error(`${a.email}: ${error.message}`)
    user = created.user
    lines.push(`${a.role}\t${a.login}\t${password}`)
  }
  const { error } = await db.from('profiles').upsert({
    id: user.id,
    role: a.role,
    full_name: a.name,
    puskesmas_id: data.puskesmas.id,
    posyandu_id: a.role === 'kader' ? data.posyandu[a.posyandu!]!.id : null,
  })
  if (error) throw new Error(`profile ${a.email}: ${error.message}`)
  console.log(`account ${a.role} ${a.login}`)
}
writeFileSync(file, lines.join('\n') + '\n')
chmodSync(file, 0o600)
