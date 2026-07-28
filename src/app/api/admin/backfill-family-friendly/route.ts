import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { inferPlaceAttributes } from '@/lib/inferPriceLevels'

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const reset = req.nextUrl.searchParams.get('reset') === '1'
  if (reset) {
    // Only reset LLM-inferred values — never touch user-set ones
    await prisma.destItem.updateMany({
      where: { type: 'food_drink', familyFriendlySource: { not: 'user' } },
      data: { familyFriendly: null, familyFriendlySource: null },
    })
  }

  const items = await prisma.destItem.findMany({
    where: { type: 'food_drink', familyFriendly: null, name: { not: '' } },
    include: { destination: { select: { name: true, country: true } } },
  })

  console.log(`[backfill-family-friendly] ${items.length} restaurants to process`)

  if (items.length === 0) {
    return Response.json({ updated: 0, total: 0, results: [] })
  }

  const { familyFriendly, priceLevels, error, stopReason } = await inferPlaceAttributes(
    items.map(item => ({
      id: item.id,
      name: item.name,
      type: 'food_drink' as const,
      destination: [item.destination.name, item.destination.country].filter(Boolean).join(', '),
    }))
  )

  console.log(`[backfill-family-friendly] got ${familyFriendly.size} ff results, ${priceLevels.size} price results, error=${error}, stopReason=${stopReason}`)

  let updated = 0
  const results: string[] = []
  if (error) results.push(`[claude error] ${error} (stopReason=${stopReason})`)

  for (const item of items) {
    const ff = familyFriendly.get(item.id)
    const price = priceLevels.get(item.id)
    if (ff === undefined && price === undefined) {
      results.push(`- ${item.name} → no data`)
      continue
    }
    const data: { familyFriendly?: boolean; familyFriendlySource?: string; priceLevel?: number } = {}
    if (ff !== undefined) { data.familyFriendly = ff; data.familyFriendlySource = 'llm' }
    if (price !== undefined && item.priceLevel === null) data.priceLevel = price
    await prisma.destItem.update({ where: { id: item.id }, data })
    const ffLabel = ff === undefined ? '' : ff ? ' 👨‍👩‍👧' : ' not-ff'
    const priceLabel = price !== undefined ? ` ${'$'.repeat(price)}` : ''
    const msg = `✓ ${item.name}${priceLabel}${ffLabel}`
    console.log(`[backfill-family-friendly] ${msg}`)
    results.push(msg)
    updated++
  }

  return Response.json({ updated, total: items.length, results, debug: { googleKeySet: !!process.env.GOOGLE_API_KEY } })
}
