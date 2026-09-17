'use server'

import { createHash } from 'node:crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { samePlanDestination, samePlanPlace } from '@/lib/planPlaceIdentity'
import type { Prisma } from '@/generated/prisma/client'

const unavailable = 'This plan is unavailable or belongs to another account.'
const pageSize = 12
function copyId(planId: string, sourceId: string) {
  return `plan-copy-${createHash('sha256').update(JSON.stringify([planId, sourceId])).digest('hex')}`
}

export async function findFriendsPlanPlaces(planId: string, query: string, before?: string) {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in to browse your friends’ trips.' }
  if (typeof query !== 'string' || !query.trim() || query.length > 160) return { error: 'Enter a city or destination.' }
  const plan = await prisma.itinerary.findFirst({ where: { id: planId, userId, isPlan: true }, select: { id: true } })
  if (!plan) return { error: unavailable }
  const search = query.trim()
  const destinationWhere = { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { country: { contains: search, mode: 'insensitive' as const } }] }
  const where = {
    visibility: 'public', user: { followers: { some: { followerId: userId, status: 'accepted' } } },
    destinations: { some: { items: { some: {} } } },
    OR: [{ title: { contains: search, mode: 'insensitive' as const } }, { destinations: { some: destinationWhere } }],
  }
  if (before && !await prisma.itinerary.findFirst({ where: { id: before, ...where }, select: { id: true } })) return { error: 'These results have changed. Search again to see the latest trips.' }
  const [trips, existing] = await Promise.all([
    prisma.itinerary.findMany({
      where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: pageSize + 1,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
      select: { id: true, title: true, user: { select: { name: true } }, destinations: {
        orderBy: { order: 'asc' }, select: { name: true, country: true, items: { orderBy: { order: 'asc' }, select: {
          id: true, name: true, type: true, placeId: true, address: true, notes: true, rating: true,
        } } },
      } },
    }),
    prisma.destItem.findMany({ where: { destination: { itineraryId: planId } }, select: { id: true, name: true, type: true, placeId: true, destination: { select: { name: true, country: true } } } }),
  ])
  return {
    trips: trips.slice(0, pageSize).map(trip => {
      const matching = trip.destinations.filter(d => `${d.name} ${d.country ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
      const destinations = matching.length ? matching : trip.destinations
      return { id: trip.id, title: trip.title, author: trip.user.name, places: destinations.flatMap(destination => destination.items.map(item => {
        const place = { ...item, destination: { name: destination.name, country: destination.country } }
        return { ...place, alreadyAdded: existing.some(saved => saved.id === copyId(planId, item.id) || samePlanPlace(saved, place)) }
      })) }
    }),
    hasMore: trips.length > pageSize,
  }
}

export async function copyPlacesToPlan(sourceIds: string[], planId: string) {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in to add places.' }
  if (!Array.isArray(sourceIds) || !sourceIds.length || sourceIds.length > 100 || sourceIds.some(id => typeof id !== 'string' || !id || id.length > 100)) return { error: 'Choose between 1 and 100 places.' }
  const ids = [...new Set(sourceIds)]
  try {
    const result = await prisma.$transaction(async tx => {
      const plan = await tx.itinerary.findFirst({ where: { id: planId, userId, isPlan: true }, select: { id: true } })
      if (!plan) return { error: unavailable }
      // Serialize bulk additions to this plan so concurrent batches cannot duplicate places.
      await tx.$queryRaw`SELECT id FROM "Itinerary" WHERE id = ${planId} FOR UPDATE`
      const sources = await tx.destItem.findMany({ where: { id: { in: ids }, destination: { itinerary: { visibility: 'public' } } }, include: { destination: true } })
      if (sources.length !== ids.length) return { error: 'One or more selected places are no longer available. Nothing was added. Update your selection and try again.' }
      const destinations = await tx.destination.findMany({ where: { itineraryId: planId }, orderBy: { order: 'asc' } })
      const existing = await tx.destItem.findMany({ where: { destination: { itineraryId: planId } }, include: { destination: true } })
      const data: Prisma.DestItemCreateManyInput[] = []
      const known = [...existing]
      for (const sourceId of ids) {
        const source = sources.find(item => item.id === sourceId)!
        const id = copyId(planId, sourceId)
        if (existing.some(item => item.id === id) || known.some(item => samePlanPlace(item, source))) continue
        let destination = destinations.find(d => samePlanDestination(d, source.destination))
        if (!destination) {
          destination = await tx.destination.create({ data: { itineraryId: planId, name: source.destination.name, country: source.destination.country, order: Math.max(-1, ...destinations.map(d => d.order)) + 1 } })
          destinations.push(destination)
        }
        const siblings = [...existing, ...data].filter(item => item.destinationId === destination.id)
        data.push({ id, destinationId: destination.id, name: source.name, type: source.type,
          address: source.address, link: source.link, placeId: source.placeId, lat: source.lat, lng: source.lng,
          order: Math.max(-1, ...siblings.map(item => item.order ?? 0)) + 1,
          groupIndex: source.type === 'hotel' ? Math.max(-1, ...siblings.map(item => item.groupIndex ?? 0)) + 1 : 0,
          // Friends' personal notes, ratings, photos and schedules stay with their trips.
          dayIndex: null, planningStatus: 'considering',
        })
        known.push(source)
      }
      if (data.length) await tx.destItem.createMany({ data })
      return { added: data.length, skipped: ids.length - data.length }
    }, { timeout: 20000 })
    if (!result.error) {
      for (const path of ['/plan', `/plan/${planId}`, `/plan/${planId}/friends`, `/itinerary/${planId}`, `/user/${userId}`]) revalidatePath(path)
    }
    return result
  } catch { return { error: 'Could not add these places. Your selection is still here; please try again.' } }
}
