import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Simple priority: lower number = earlier in the day
function getMealPriority(type: string, mealType: string | null): number {
  if (type === 'activity') return 30
  if (!mealType) return 25 // unlabeled food sits between lunch and dinner
  const scores = mealType.toLowerCase().split(',').map(mt => mt.trim()).map(mt => {
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

export async function POST(req: Request) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const itineraries = await prisma.itinerary.findMany({
    where: { postType: { not: 'guide' } },
    include: {
      destinations: {
        include: { items: { orderBy: { order: 'asc' } } }
      }
    }
  })

  let updatedCount = 0
  const log: string[] = []

  for (const it of itineraries) {
    for (const dest of it.destinations) {
      const dayMap = new Map<string, typeof dest.items>()
      for (const item of dest.items) {
        if (item.type === 'hotel') continue
        const key = `${item.groupIndex ?? 0}__${item.dayIndex ?? 0}`
        if (!dayMap.has(key)) dayMap.set(key, [])
        dayMap.get(key)!.push(item)
      }

      for (const [key, dayItems] of dayMap) {
        const sorted = [...dayItems].sort((a, b) => {
          const pa = getMealPriority(a.type, a.mealType) * 10000 + (a.order ?? 0)
          const pb = getMealPriority(b.type, b.mealType) * 10000 + (b.order ?? 0)
          return pa - pb
        })

        for (let i = 0; i < sorted.length; i++) {
          if ((sorted[i].order ?? 0) !== i) {
            await prisma.destItem.update({ where: { id: sorted[i].id }, data: { order: i } })
            updatedCount++
            log.push(`${it.title} / ${dest.name} / day ${key}: "${sorted[i].name}" → order ${i}`)
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, updatedCount, log })
}
