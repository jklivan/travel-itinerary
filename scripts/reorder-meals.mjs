/**
 * One-off script: reorders DestItem rows within each day so meals appear in
 * chronological schedule order (breakfast → bakery → lunch → dinner → drinks → dessert/coffee).
 * Activities stay in their relative positions (between lunch and dinner).
 *
 * Only touches itineraries (postType != 'guide').
 *
 * Run: node scripts/reorder-meals.mjs
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Force-override DATABASE_URL from .env.neon BEFORE Prisma is instantiated ──
// This overrides whatever dotenvx injected via shell hook.
const envContent = readFileSync(resolve(__dir, '../.env.neon'), 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (trimmed.startsWith('#') || !trimmed.startsWith('DATABASE_URL=')) continue
  let val = trimmed.slice('DATABASE_URL='.length)
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1)
  }
  process.env.DATABASE_URL = val
  console.log('DATABASE_URL set to:', val.slice(0, 60) + '...')
  break
}

// ── Import Prisma client AFTER env is set ──────────────────────────────────────
const { PrismaClient } = await import('../src/generated/prisma/client.ts')
const prisma = new PrismaClient()

// ── Meal priority (lower = earlier in the day) ────────────────────────────────
function getMealPriority(type, mealType) {
  if (type === 'hotel') return -1
  if (type === 'activity') return 30
  if (!mealType) return 25 // unlabeled food: between lunch and dinner
  const parts = mealType.toLowerCase().split(',').map(s => s.trim())
  const scores = parts.map(mt => {
    if (mt === 'breakfast') return 10
    if (mt === 'bakery')    return 15
    if (mt === 'lunch')     return 20
    if (mt === 'dinner')    return 40
    if (mt === 'drinks')    return 50
    if (mt === 'dessert')   return 60
    if (mt === 'coffee')    return 65
    return 25
  })
  return Math.min(...scores)
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const itineraries = await prisma.itinerary.findMany({
    where: { postType: { not: 'guide' } },
    include: {
      destinations: {
        include: { items: { orderBy: { order: 'asc' } } }
      }
    }
  })

  console.log(`Found ${itineraries.length} itineraries to process`)
  let updatedCount = 0

  for (const it of itineraries) {
    for (const dest of it.destinations) {
      // Group non-hotel items by (groupIndex, dayIndex)
      const dayMap = new Map()
      for (const item of dest.items) {
        if (item.type === 'hotel') continue
        const key = `${item.groupIndex ?? 0}__${item.dayIndex ?? 0}`
        if (!dayMap.has(key)) dayMap.set(key, [])
        dayMap.get(key).push(item)
      }

      for (const [, dayItems] of dayMap) {
        const sorted = [...dayItems].sort((a, b) => {
          const pa = getMealPriority(a.type, a.mealType) * 10000 + (a.order ?? 0)
          const pb = getMealPriority(b.type, b.mealType) * 10000 + (b.order ?? 0)
          return pa - pb
        })

        for (let i = 0; i < sorted.length; i++) {
          if ((sorted[i].order ?? 0) !== i) {
            await prisma.destItem.update({ where: { id: sorted[i].id }, data: { order: i } })
            updatedCount++
          }
        }
      }
    }
  }

  console.log(`Done. Updated ${updatedCount} item order(s).`)
  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
