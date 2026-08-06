import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export const maxDuration = 300

const API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API

async function findWebsite(name: string, destination: string): Promise<string | null> {
  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY!,
        'X-Goog-FieldMask': 'places.websiteUri',
      },
      body: JSON.stringify({ textQuery: [name, destination].filter(Boolean).join(', '), pageSize: 1 }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return null
    const data = await response.json() as { places?: { websiteUri?: string }[] }
    return data.places?.[0]?.websiteUri ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!API_KEY) return Response.json({ error: 'GOOGLE_PLACES_API_KEY not set' }, { status: 500 })

  const requestedLimit = Number(req.nextUrl.searchParams.get('limit') ?? '75')
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100) : 75
  const includeRemaining = req.nextUrl.searchParams.get('details') === '1'
  const items = await prisma.destItem.findMany({
    where: { type: { in: ['hotel', 'food_drink'] }, name: { not: '' }, OR: [{ link: null }, { link: '' }] },
    select: { id: true, name: true, destination: { select: { name: true, country: true } } },
    take: limit,
  })

  let updated = 0
  let noWebsite = 0
  for (const item of items) {
    const destination = [item.destination.name, item.destination.country].filter(Boolean).join(', ')
    const website = await findWebsite(item.name, destination)
    if (website) {
      // Keep a link entered by a user after this run began.
      const result = await prisma.destItem.updateMany({
        where: { id: item.id, OR: [{ link: null }, { link: '' }] },
        data: { link: website },
      })
      updated += result.count
    } else {
      noWebsite++
    }
    await new Promise((resolve) => setTimeout(resolve, 125))
  }

  const remainingWhere = { type: { in: ['hotel', 'food_drink'] }, name: { not: '' }, OR: [{ link: null }, { link: '' }] }
  const remaining = await prisma.destItem.count({ where: remainingWhere })
  const remainingItems = includeRemaining
    ? await prisma.destItem.findMany({
        where: remainingWhere,
        select: { name: true, type: true, destination: { select: { name: true, country: true } } },
        take: 100,
      })
    : undefined
  return Response.json({ processed: items.length, updated, noWebsite, remaining, ...(includeRemaining ? { remainingItems } : {}) })
}
