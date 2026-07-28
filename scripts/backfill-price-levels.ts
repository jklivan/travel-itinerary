import { readFileSync } from 'fs'
import { resolve } from 'path'
import postgres from 'postgres'

// Load env vars from .env and .env.local
for (const file of ['.env', '.env.local']) {
  try {
    const content = readFileSync(resolve(process.cwd(), file), 'utf8')
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=\s][^=]*)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const val = match[2].trim().replace(/^['"]|['"]$/g, '')
        if (!process.env[key]) process.env[key] = val
      }
    }
  } catch { /* file may not exist */ }
}

const API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API
if (!API_KEY) { console.error('No GOOGLE_PLACES_API key found'); process.exit(1) }
if (!process.env.DATABASE_URL) { console.error('No DATABASE_URL found'); process.exit(1) }

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 })

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE:    1,
  PRICE_LEVEL_MODERATE:       2,
  PRICE_LEVEL_EXPENSIVE:      3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
}

async function searchPlacePrice(name: string, context: string): Promise<number | null> {
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY!,
        'X-Goog-FieldMask': 'places.priceLevel',
      },
      body: JSON.stringify({ textQuery: `${name} ${context}`.trim(), pageSize: 1 }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json() as { places?: { priceLevel?: string }[] }
    const place = data.places?.[0]
    if (!place?.priceLevel) return null
    return PRICE_LEVEL_MAP[place.priceLevel] ?? null
  } catch {
    return null
  }
}

async function main() {
  const items = await sql<{ id: string; name: string; type: string; dest_name: string; dest_country: string | null }[]>`
    SELECT di.id, di.name, di.type, d.name AS dest_name, d.country AS dest_country
    FROM "DestItem" di
    JOIN "Destination" d ON d.id = di."destinationId"
    WHERE di.type IN ('hotel', 'food_drink')
      AND di."priceLevel" IS NULL
      AND di.name <> ''
  `

  console.log(`Found ${items.length} items to backfill`)
  if (items.length === 0) { await sql.end(); return }

  let updated = 0
  let skipped = 0

  for (const item of items) {
    const context = [item.dest_name, item.dest_country].filter(Boolean).join(', ')
    const priceLevel = await searchPlacePrice(item.name, context)

    if (priceLevel !== null) {
      await sql`UPDATE "DestItem" SET "priceLevel" = ${priceLevel} WHERE id = ${item.id}`
      console.log(`  ✓ ${item.name} (${item.type}) → ${'$'.repeat(priceLevel)}`)
      updated++
    } else {
      console.log(`  - ${item.name} (${item.type}) → no price level found`)
      skipped++
    }

    await new Promise(r => setTimeout(r, 150))
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped`)
  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
