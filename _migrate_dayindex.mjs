import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'

const env = readFileSync('.env.neon', 'utf8')

// Find DATABASE_URL line, handle quoted values and multi-line
let url = null
for (const line of env.split('\n')) {
  const trimmed = line.trim()
  if (trimmed.startsWith('DATABASE_URL=')) {
    url = trimmed.slice('DATABASE_URL='.length).trim()
    // Strip surrounding quotes if present
    if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
      url = url.slice(1, -1)
    }
    break
  }
}

if (!url) { console.error('DATABASE_URL not found in .env.neon'); process.exit(1) }

const proto = url.slice(0, 15)
console.log('URL starts with:', proto + '...')

if (!url.startsWith('postgres')) {
  console.error('Not a postgres URL — dump of .env.neon lines:')
  env.split('\n').forEach((l, i) => console.log(i, JSON.stringify(l.slice(0, 40))))
  process.exit(1)
}

const sql = neon(url)
try {
  await sql`ALTER TABLE "DestItem" ADD COLUMN IF NOT EXISTS "dayIndex" INTEGER`
  console.log('✓ dayIndex column added to DestItem')
} catch (e) {
  console.error('Failed:', e.message)
  process.exit(1)
}
