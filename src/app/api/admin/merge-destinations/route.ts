import { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { samePlanDestination } from '@/lib/planPlaceIdentity'

// Finds trips where the same city ended up as two destinations (e.g. "Capri · Italy" and
// "Capri · Metropolitan City of Naples, Italy") and, for one named trip, merges them.
//   ?secret=…                       list every trip with duplicates (changes nothing)
//   ?secret=…&trip=<id>&apply=1     merge that trip's duplicates into its first matching destination
// Merging is per trip on purpose: a trip can visit the same city twice (start and end in Rome).
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  if (params.get('secret') !== process.env.ADMIN_SECRET) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const tripId = params.get('trip')
  const apply = params.get('apply') === '1'
  if (apply && !tripId) return Response.json({ error: 'Choose one trip to merge with &trip=<id>.' }, { status: 400 })

  const trips = await prisma.itinerary.findMany({
    where: tripId ? { id: tripId } : { destinations: { some: {} } },
    select: { id: true, title: true, userId: true, user: { select: { name: true } },
      destinations: { orderBy: { order: 'asc' }, select: { id: true, name: true, country: true, order: true, items: { select: { id: true, name: true, type: true, order: true, groupIndex: true } } } } },
  })

  const found = trips.flatMap(trip => {
    const used = new Set<string>()
    const groups = trip.destinations.flatMap((keep, index) => {
      if (used.has(keep.id)) return []
      const duplicates = trip.destinations.slice(index + 1).filter(other => !used.has(other.id) && samePlanDestination(keep, other))
      duplicates.forEach(duplicate => used.add(duplicate.id))
      return duplicates.length ? [{ keep, duplicates }] : []
    })
    return groups.length ? [{ trip, groups }] : []
  })

  const summary = found.map(({ trip, groups }) => ({
    trip: trip.id, title: trip.title, owner: trip.user.name,
    merge: groups.map(({ keep, duplicates }) => ({
      into: `${keep.name}${keep.country ? ` · ${keep.country}` : ''} (${keep.items.length} places)`,
      from: duplicates.map(duplicate => `${duplicate.name}${duplicate.country ? ` · ${duplicate.country}` : ''} (${duplicate.items.map(item => item.name).join(', ') || 'empty'})`),
    })),
  }))
  if (!apply) return Response.json({ dryRun: true, trips: summary.length, summary })
  if (!found.length) return Response.json({ merged: 0, message: 'No duplicate destinations in this trip.' })

  const { trip, groups } = found[0]
  await prisma.$transaction(async tx => {
    for (const { keep, duplicates } of groups) {
      let nextOrder = Math.max(-1, ...keep.items.map(item => item.order)) + 1
      let nextGroup = Math.max(-1, ...keep.items.map(item => item.groupIndex)) + 1
      for (const duplicate of duplicates) {
        // A duplicate with its own hotel stays a separate stay; otherwise its places join the existing one.
        const hasStay = duplicate.items.some(item => item.type === 'hotel')
        for (const item of [...duplicate.items].sort((a, b) => a.order - b.order)) {
          await tx.destItem.update({ where: { id: item.id }, data: { destinationId: keep.id, order: nextOrder++, ...(hasStay ? { groupIndex: nextGroup + item.groupIndex } : {}) } })
        }
        if (hasStay) nextGroup += Math.max(0, ...duplicate.items.map(item => item.groupIndex)) + 1
        await tx.destination.delete({ where: { id: duplicate.id } })
      }
    }
  })
  for (const path of ['/', '/explore', `/plan/${trip.id}`, `/itinerary/${trip.id}`, `/user/${trip.userId}`]) revalidatePath(path)
  return Response.json({ merged: groups.reduce((sum, group) => sum + group.duplicates.length, 0), summary: summary[0] })
}
