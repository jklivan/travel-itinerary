import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateDescriptions } from '@/lib/generateDescriptions'

const BATCH_SIZE = 10

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const items = await prisma.destItem.findMany({
    where: { type: { in: ['hotel', 'food_drink'] }, description: null, name: { not: '' } },
    include: { destination: { select: { name: true, country: true } } },
  })

  console.log(`[backfill-descriptions] ${items.length} items to process`)

  let updated = 0
  let skipped = 0
  const results: string[] = []

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    console.log(`[backfill-descriptions] batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} items`)

    const descriptionMap = await generateDescriptions(
      batch.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type as 'hotel' | 'food_drink',
        destination: [item.destination.name, item.destination.country].filter(Boolean).join(', '),
        mealType: item.mealType,
        priceLevel: item.priceLevel,
      }))
    )

    for (const item of batch) {
      const description = descriptionMap.get(item.id)
      if (description) {
        await prisma.destItem.update({ where: { id: item.id }, data: { description } })
        const msg = `✓ ${item.name} (${item.type}) → "${description}"`
        console.log(`[backfill-descriptions] ${msg}`)
        results.push(msg)
        updated++
      } else {
        const msg = `- ${item.name} (${item.type}) → no description generated`
        results.push(msg)
        skipped++
      }
    }
  }

  return Response.json({ updated, skipped, total: items.length, results })
}
