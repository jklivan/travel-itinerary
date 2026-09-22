'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { scheduleTripPublishedNotifications } from '@/lib/tripPublishedNotifications'

type Result = { error?: string; success?: boolean; id?: string }
class InputError extends Error {}

const unavailable = 'This trip is unavailable or belongs to another account.'
function text(form: FormData, key: string, max: number) {
  const value = form.get(key)
  if (typeof value !== 'string' || value.length > max) throw new InputError(`Please check ${key}.`)
  return value.trim()
}
function dates(form: FormData) {
  const start = text(form, 'startDate', 10)
  const end = text(form, 'endDate', 10)
  if (!start && !end) return { datesFlexible: true, startDate: new Date('2000-01-01T00:00:00Z'), endDate: new Date('2000-01-01T00:00:00Z') }
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  if (!valid(start) || !valid(end) || end < start) throw new InputError('Choose a start and end date, with the end after the start, or leave both blank.')
  return { datesFlexible: false, startDate: new Date(start), endDate: new Date(end) }
}
function duration(form: FormData) {
  if (!form.has('durationDays')) return null
  const raw = text(form, 'durationDays', 8)
  if (!raw) return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > 10000) throw new InputError('Enter a positive whole number of days.')
  return value
}
function refresh(id: string, userId: string) {
  for (const path of ['/', '/plan', `/plan/${id}`, `/itinerary/${id}`, `/user/${userId}`, '/explore']) revalidatePath(path)
}
function message(error: unknown) {
  return { error: error instanceof InputError ? error.message : 'Could not save. Your changes are still here; please try again.' }
}

export async function startPlan(form: FormData): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in to start planning.' }
  try {
    const title = text(form, 'title', 160)
    const destination = text(form, 'destination', 160)
    const audience = text(form, 'audience', 20) || 'family'
    if (!['family', 'friends', 'romantic', 'adult'].includes(audience)) throw new InputError('Choose who the trip is for.')
    const id = text(form, 'clientId', 50)
    if (!/^[a-f0-9-]{36}$/.test(id)) return { error: 'Please reload and try again.' }
    if (!title && !destination) return { error: 'Enter a trip name or destination to get started.' }
    const dateFields = dates(form)
    // Reusing this ID makes a retry safe even if the first response was lost.
    const existing = await prisma.itinerary.findUnique({ where: { id }, select: { userId: true } })
    if (existing) return existing.userId === userId ? { id } : { error: unavailable }
    await prisma.itinerary.create({ data: {
      id, userId, title: title || `Trip to ${destination}`, audience, visibility: 'draft', isPlan: true, ...dateFields,
      durationDays: form.get('format') === 'day-trip' ? 1 : duration(form),
      tags: form.get('format') === 'day-trip' ? ['day-trip'] : [],
      destinations: { create: { name: destination || 'Destination to decide', order: 0 } },
    } })
    refresh(id, userId)
    return { id }
  } catch (error) { return message(error) }
}

export async function savePlanDetails(id: string, form: FormData): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  try {
    const title = text(form, 'title', 160)
    if (!title) return { error: 'Give your trip a name.' }
    const audience = text(form, 'audience', 20)
    if (!['family', 'friends', 'romantic', 'adult'].includes(audience)) return { error: 'Choose a trip type.' }
    const result = await prisma.itinerary.updateMany({ where: { id, userId, isPlan: true }, data: { title, audience, ...dates(form), ...(form.has('durationDays') ? { durationDays: duration(form) } : {}) } })
    if (!result.count) return { error: unavailable }
    refresh(id, userId)
    return { success: true }
  } catch (error) { return message(error) }
}

export async function addPlanPlace(id: string, form: FormData): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  try {
    const name = text(form, 'name', 240)
    const placeId = form.has('placeId') ? text(form, 'placeId', 512) || null : undefined
    const type = text(form, 'type', 20)
    const destinationName = text(form, 'destination', 160)
    const notes = text(form, 'notes', 8000)
    const clientId = text(form, 'clientId', 50)
    const rating = Number(form.get('rating') ?? 0)
    if (!Number.isInteger(rating) || rating < 0 || rating > 5) throw new InputError('Choose a rating from 1 to 5, or leave it blank.')
    const mealType = form.has('mealType') ? text(form, 'mealType', 100) : ''
    if (mealType && mealType.split(',').some(value => !['breakfast', 'lunch', 'dinner', 'drinks', 'coffee', 'dessert', 'bakery'].includes(value))) throw new InputError('Choose a meal type from the available tags.')
    function stringList(key: string, limit: number, maxLength: number) {
      if (!form.has(key)) return [] as string[]
      let values: unknown
      try { values = JSON.parse(text(form, key, 100000)) } catch { throw new InputError(`Please check ${key}.`) }
      if (!Array.isArray(values) || values.length > limit || values.some(value => typeof value !== 'string' || value.length > maxLength)) throw new InputError(`Please check ${key}.`)
      return values as string[]
    }
    const tags = stringList('tags', 40, 100)
    const photoUrls = stringList('photos', 20, 4096)
    if (photoUrls.some(url => !/^(https:\/\/|\/(?!\/))/.test(url))) throw new InputError('Please choose valid photos.')

    if (!name || !destinationName || !['hotel', 'food_drink', 'activity', 'transport'].includes(type) || !/^[a-f0-9-]{36}$/.test(clientId)) return { error: 'Enter a place name and destination.' }
    const day = text(form, 'day', 4)
    if (day && (!/^\d+$/.test(day) || Number(day) < 1 || Number(day) > 365)) return { error: 'Choose a day from 1 to 365, or leave it unscheduled.' }
    await prisma.$transaction(async tx => {
      const trip = await tx.itinerary.findFirst({ where: { id, userId }, select: { id: true } })
      if (!trip) throw new InputError(unavailable)
      const existing = await tx.destItem.findUnique({ where: { id: clientId }, select: { destination: { select: { itineraryId: true } } } })
      if (existing) {
        if (existing.destination.itineraryId !== id) throw new InputError(unavailable)
        return
      }
      let dest = await tx.destination.findFirst({ where: { itineraryId: id, name: { equals: destinationName, mode: 'insensitive' } } })
      if (!dest) dest = await tx.destination.create({ data: { itineraryId: id, name: destinationName, order: await tx.destination.count({ where: { itineraryId: id } }) } })
      const last = await tx.destItem.aggregate({ where: { destinationId: dest.id }, _max: { order: true, groupIndex: true } })
      const zeroBased = await tx.destItem.count({ where: { destinationId: dest.id, dayIndex: 0, type: { not: 'hotel' } } })
      if (zeroBased) await tx.destItem.updateMany({ where: { destinationId: dest.id, dayIndex: { not: null } }, data: { dayIndex: { increment: 1 } } })
      await tx.destItem.create({ data: { id: clientId, destinationId: dest.id, name, type, placeId: placeId ?? null, notes: notes || null,
        rating: rating || null, mealType: type === 'food_drink' ? mealType || null : null, tags, photoUrls, photoUrl: photoUrls[0] ?? null,
        dayIndex: day ? Number(day) : null,
        order: (last._max.order ?? -1) + 1, groupIndex: type === 'hotel' ? (last._max.groupIndex ?? -1) + 1 : 0,
      } })
    })
    refresh(id, userId)
    return { success: true }
  } catch (error) { return message(error) }
}

export async function editPlanPlace(itemId: string, form: FormData): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  try {
    const name = text(form, 'name', 240)
    const placeId = form.has('placeId') ? text(form, 'placeId', 512) || null : undefined
    const notes = text(form, 'notes', 8000)
    const status = text(form, 'status', 20)
    const day = text(form, 'day', 4)
    if (!name || !['considering', 'booked', 'visited'].includes(status)) return { error: 'Enter a place name and choose a status.' }
    if (day && (!/^\d+$/.test(day) || Number(day) < 1 || Number(day) > 365)) return { error: 'Choose a day from 1 to 365, or leave it unscheduled.' }
    const owned = { id: itemId, destination: { itinerary: { userId } } }
    const item = await prisma.destItem.findFirst({ where: owned, select: { name: true, placeId: true, destinationId: true, destination: { select: { itineraryId: true } } } })
    if (!item) return { error: unavailable }
    const nextPlaceId = placeId === undefined ? (name === item.name ? item.placeId : null) : placeId
    const identityChanged = nextPlaceId !== item.placeId || name !== item.name
    await prisma.$transaction(async tx => {
      const zeroBased = await tx.destItem.count({ where: { destinationId: item.destinationId, dayIndex: 0, type: { not: 'hotel' } } })
      if (zeroBased) await tx.destItem.updateMany({ where: { destinationId: item.destinationId, dayIndex: { not: null } }, data: { dayIndex: { increment: 1 } } })
      const result = await tx.destItem.updateMany({ where: owned, data: { name, placeId: nextPlaceId, ...(identityChanged ? { lat: null, lng: null, address: null, link: null, description: null } : {}), notes: notes || null, planningStatus: status, dayIndex: day ? Number(day) : null } })
      if (!result.count) throw new InputError(unavailable)
    })
    refresh(item.destination.itineraryId, userId)
    return { success: true }
  } catch (error) { return message(error) }
}

export async function sharePlan(id: string, format: 'guide' | 'day-trip' | 'itinerary' = 'itinerary', details: { budget?: number; tripRating?: number; tags?: string[] } = {}): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  try {
    const trip = await prisma.itinerary.findFirst({ where: { id, userId, isPlan: true, destinations: { some: { items: { some: {} } } } }, select: { id: true, durationDays: true } })
    if (!trip) return { error: 'Add at least one place before sharing your trip.' }
    const budget = details.budget && details.budget >= 1 && details.budget <= 5 ? Math.floor(details.budget) : null
    const tripRating = details.tripRating && details.tripRating >= 1 && details.tripRating <= 5 ? Math.floor(details.tripRating) : null
    const tags = Array.isArray(details.tags) ? [...new Set(details.tags.filter(tag => typeof tag === 'string').slice(0, 20))] : []
    const result = await prisma.itinerary.updateMany({ where: { id, userId, visibility: 'draft' }, data: { visibility: 'public', postType: format, durationDays: format === 'day-trip' ? 1 : format === 'guide' ? null : trip.durationDays, budget, tripRating, tags: format === 'day-trip' ? [...new Set(['day-trip', ...tags])] : tags } })
    if (result.count) scheduleTripPublishedNotifications(id)
    refresh(id, userId)
    return { success: true }
  } catch { return { error: 'Could not share your trip. Please try again.' } }
}

export async function removePlanPlace(itemId: string): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  try {
    const owned = { id: itemId, destination: { itinerary: { userId } } }
    const item = await prisma.destItem.findFirst({ where: owned, select: { destination: { select: { itineraryId: true } } } })
    if (!item) return { error: unavailable }
    await prisma.destItem.deleteMany({ where: owned })
    refresh(item.destination.itineraryId, userId)
    return { success: true }
  } catch { return { error: 'Could not remove this place. Please try again.' } }
}

export async function plansForSaving() {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in to save a place.', trips: [] }
  const trips = await prisma.itinerary.findMany({ where: { userId, isPlan: true }, select: { id: true, title: true }, orderBy: { createdAt: 'desc' } })
  return { trips }
}

export async function copyPlaceToPlan(sourceId: string, planId: string, clientId: string): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (!/^[a-f0-9-]{36}$/.test(clientId)) return { error: 'Please reload and try again.' }
  try {
    await prisma.$transaction(async tx => {
      const plan = await tx.itinerary.findFirst({ where: { id: planId, userId, isPlan: true }, select: { id: true } })
      if (!plan) throw new InputError(unavailable)
      const source = await tx.destItem.findFirst({ where: { id: sourceId, destination: { itinerary: { visibility: 'public' } } }, include: { destination: true } })
      if (!source) throw new InputError('This place is no longer available.')
      const existing = await tx.destItem.findUnique({ where: { id: clientId }, select: { destination: { select: { itineraryId: true } } } })
      if (existing) {
        if (existing.destination.itineraryId !== planId) throw new InputError(unavailable)
        return
      }
      let destination = await tx.destination.findFirst({ where: { itineraryId: planId, name: { equals: source.destination.name, mode: 'insensitive' } } })
      if (!destination) destination = await tx.destination.create({ data: { itineraryId: planId, name: source.destination.name, country: source.destination.country, order: await tx.destination.count({ where: { itineraryId: planId } }) } })
      const last = await tx.destItem.aggregate({ where: { destinationId: destination.id }, _max: { order: true, groupIndex: true } })
      await tx.destItem.create({ data: { id: clientId, destinationId: destination.id, name: source.name, type: source.type,
        address: source.address, link: source.link, placeId: source.placeId, lat: source.lat, lng: source.lng,
        order: (last._max.order ?? -1) + 1, groupIndex: source.type === 'hotel' ? (last._max.groupIndex ?? -1) + 1 : 0,
        // Personal notes, photos, ratings and day assignments stay with their author.
      } })
    })
    refresh(planId, userId)
    return { success: true }
  } catch (error) { return message(error) }
}
