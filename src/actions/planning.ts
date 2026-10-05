'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { samePlanDestination } from '@/lib/planPlaceIdentity'
import { scheduleTripPublishedNotifications } from '@/lib/tripPublishedNotifications'

type Result = { error?: string; success?: boolean; id?: string }
class InputError extends Error {}

const unavailable = 'This trip is unavailable or belongs to another account.'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// "When to go": known month names only, in calendar order.
function bestMonths(value: unknown) {
  return Array.isArray(value) ? MONTHS.filter(month => value.includes(month)) : []
}
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
  for (const path of ['/', '/plan', `/plan/${id}`, `/itinerary/${id}`, `/user/${userId}`, '/trips', '/explore']) revalidatePath(path)
}
function stringList(form: FormData, key: string, limit: number, maxLength: number) {
  if (!form.has(key)) return [] as string[]
  let values: unknown
  try { values = JSON.parse(text(form, key, 100000)) } catch { throw new InputError(`Please check ${key}.`) }
  if (!Array.isArray(values) || values.length > limit || values.some(value => typeof value !== 'string' || value.length > maxLength)) throw new InputError(`Please check ${key}.`)
  return values as string[]
}
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'drinks', 'coffee', 'dessert', 'bakery']
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
    const format = form.get('format') ?? 'itinerary'
    if (!['guide', 'day-trip', 'itinerary'].includes(String(format))) throw new InputError('Choose a trip format.')
    const dateFields = dates(form)
    // Reusing this ID makes a retry safe even if the first response was lost.
    const existing = await prisma.itinerary.findUnique({ where: { id }, select: { userId: true } })
    if (existing) return existing.userId === userId ? { id } : { error: unavailable }
    await prisma.itinerary.create({ data: {
      id, userId, title: title || `Trip to ${destination}`, audience, visibility: 'draft', isPlan: true, ...dateFields,
      postType: String(format),
      durationDays: format === 'guide' ? null : format === 'day-trip' ? 1 : duration(form),
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
    // Whole-trip notes & tips and When to go are only changed when the form sends them.
    const extra: { notes?: string | null; bestMonths?: string[] } = {}
    if (form.has('notes')) extra.notes = text(form, 'notes', 8000) || null
    if (form.has('bestMonths')) { try { extra.bestMonths = bestMonths(JSON.parse(String(form.get('bestMonths')))) } catch { extra.bestMonths = [] } }
    const result = await prisma.itinerary.updateMany({ where: { id, userId }, data: { title, audience, ...dates(form), ...(form.has('durationDays') ? { durationDays: duration(form) } : {}), ...extra } })
    if (!result.count) return { error: unavailable }
    refresh(id, userId)
    return { success: true }
  } catch (error) { return message(error) }
}

// The planner's "How many days is your trip?" prompt: sets the length (one day makes it a day trip).
export async function setPlanDays(id: string, days: number): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (!Number.isInteger(days) || days < 1 || days > 365) return { error: 'Enter a number of days from 1 to 365.' }
  try {
    const trip = await prisma.itinerary.findFirst({ where: { id, userId }, select: { tags: true } })
    if (!trip) return { error: unavailable }
    const tags = days === 1 ? [...new Set([...trip.tags, 'day-trip'])] : trip.tags.filter(tag => tag !== 'day-trip')
    await prisma.itinerary.updateMany({ where: { id, userId }, data: { durationDays: days, postType: days === 1 ? 'day-trip' : 'itinerary', tags } })
    refresh(id, userId)
    return { success: true }
  } catch { return { error: 'Could not save. Please try again.' } }
}

// Removes one day from a day-by-day trip: its places become unscheduled and later days move up one.
export async function deletePlanDay(id: string, day: number): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (!Number.isInteger(day) || day < 1 || day > 365) return { error: 'Choose a day to delete.' }
  try {
    const trip = await prisma.itinerary.findFirst({ where: { id, userId }, select: { durationDays: true, tags: true, destinations: { select: { items: { select: { id: true, type: true, dayIndex: true } } } } } })
    if (!trip) return { error: unavailable }
    if (!trip.durationDays || trip.durationDays <= 1 || day > trip.durationDays) return { error: 'A trip needs at least one day.' }
    const updates: { id: string; dayIndex: number | null }[] = []
    for (const destination of trip.destinations) {
      // Older trips count days from 0; the planner shows them from 1. Save the new days from 1.
      const offset = destination.items.some(item => item.type !== 'hotel' && item.dayIndex === 0) ? 1 : 0
      for (const item of destination.items) {
        if (item.dayIndex === null) continue
        const shown = item.dayIndex + offset
        const next = shown === day ? null : shown > day ? shown - 1 : shown
        if (next !== item.dayIndex) updates.push({ id: item.id, dayIndex: next })
      }
    }
    const days = trip.durationDays - 1
    const tags = days === 1 ? [...new Set([...trip.tags, 'day-trip'])] : trip.tags.filter(tag => tag !== 'day-trip')
    await prisma.$transaction([
      ...updates.map(update => prisma.destItem.update({ where: { id: update.id }, data: { dayIndex: update.dayIndex } })),
      prisma.itinerary.updateMany({ where: { id, userId }, data: { durationDays: days, postType: days === 1 ? 'day-trip' : 'itinerary', tags } }),
    ])
    refresh(id, userId)
    return { success: true }
  } catch { return { error: 'Could not delete this day. Please try again.' } }
}

// Day chips: put one place on a day. A day past the trip's length makes the trip longer to fit it.
export async function setPlaceDay(itemId: string, day: number | null): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (day !== null && (!Number.isInteger(day) || day < 1 || day > 365)) return { error: 'Choose a day.' }
  try {
    const owned = { id: itemId, destination: { itinerary: { userId } } }
    const item = await prisma.destItem.findFirst({ where: owned, select: { destinationId: true, destination: { select: { itinerary: { select: { id: true, durationDays: true, tags: true } } } } } })
    if (!item) return { error: unavailable }
    const trip = item.destination.itinerary
    await prisma.$transaction(async tx => {
      // Older trips count days from 0; move them to count from 1 first, as the planner shows them.
      const zeroBased = await tx.destItem.count({ where: { destinationId: item.destinationId, dayIndex: 0, type: { not: 'hotel' } } })
      if (zeroBased) await tx.destItem.updateMany({ where: { destinationId: item.destinationId, dayIndex: { not: null } }, data: { dayIndex: { increment: 1 } } })
      await tx.destItem.updateMany({ where: owned, data: { dayIndex: day } })
      if (day !== null && trip.durationDays && day > trip.durationDays) await tx.itinerary.updateMany({ where: { id: trip.id, userId }, data: { durationDays: day, postType: 'itinerary', tags: trip.tags.filter(tag => tag !== 'day-trip') } })
    })
    refresh(trip.id, userId)
    return { success: true }
  } catch { return { error: 'Could not move this place. Please try again.' } }
}

// "Organize with AI" → Apply: puts each listed place on its day. Only places still unscheduled move.
export async function applyDayPlan(tripId: string, assignments: { id: string; day: number }[]): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (!Array.isArray(assignments) || assignments.length > 500 || assignments.some(a => !a || typeof a.id !== 'string' || a.id.length > 100 || !Number.isInteger(a.day) || a.day < 1 || a.day > 365)) return { error: 'Please try organizing again.' }
  try {
    const trip = await prisma.itinerary.findFirst({ where: { id: tripId, userId }, select: { durationDays: true, destinations: { select: { id: true, items: { select: { id: true, type: true, dayIndex: true } } } } } })
    if (!trip) return { error: unavailable }
    const days = trip.durationDays ?? 0
    await prisma.$transaction(async tx => {
      for (const destination of trip.destinations) {
        const moving = assignments.filter(a => a.day <= days && destination.items.some(item => item.id === a.id && item.dayIndex === null))
        if (!moving.length) continue
        // Older trips count days from 0; move them to count from 1 first, as the planner shows them.
        if (destination.items.some(item => item.type !== 'hotel' && item.dayIndex === 0)) await tx.destItem.updateMany({ where: { destinationId: destination.id, dayIndex: { not: null } }, data: { dayIndex: { increment: 1 } } })
        for (const a of moving) await tx.destItem.updateMany({ where: { id: a.id, destinationId: destination.id, dayIndex: null }, data: { dayIndex: a.day } })
      }
    })
    refresh(tripId, userId)
    return { success: true }
  } catch { return { error: 'Could not apply the plan. Please try again.' } }
}

// Choose a trip's cover photo: one of its own trip or place photos (null goes back to the first photo).
export async function setTripCover(id: string, url: string | null): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  try {
    const trip = await prisma.itinerary.findFirst({ where: { id, userId }, select: { photos: { select: { url: true } }, destinations: { select: { items: { select: { photoUrl: true, photoUrls: true } } } } } })
    if (!trip) return { error: unavailable }
    const own = new Set([...trip.photos.map(photo => photo.url), ...trip.destinations.flatMap(d => d.items.flatMap(item => [...item.photoUrls, ...(item.photoUrl ? [item.photoUrl] : [])]))])
    if (url !== null && (typeof url !== 'string' || !own.has(url))) return { error: 'Choose one of this trip’s photos.' }
    await prisma.itinerary.updateMany({ where: { id, userId }, data: { coverPhoto: url } })
    refresh(id, userId)
    return { success: true }
  } catch { return { error: 'Could not save the cover photo. Please try again.' } }
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
    const status = form.has('status') ? text(form, 'status', 20) : 'considering'
    if (!['considering', 'booked', 'visited'].includes(status)) throw new InputError('Choose a valid place status.')
    const rating = Number(form.get('rating') ?? 0)
    if (!Number.isInteger(rating) || rating < 0 || rating > 5) throw new InputError('Choose a rating from 1 to 5, or leave it blank.')
    const mealType = form.has('mealType') ? text(form, 'mealType', 100) : ''
    if (mealType && mealType.split(',').some(value => !MEAL_TYPES.includes(value))) throw new InputError('Choose a meal type from the available tags.')
    const tags = stringList(form, 'tags', 40, 100)
    const photoUrls = stringList(form, 'photos', 20, 4096)
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
      let dest = (await tx.destination.findMany({ where: { itineraryId: id }, orderBy: { order: 'asc' } })).find(existing => samePlanDestination(existing, { name: destinationName })) ?? null
      if (!dest) dest = await tx.destination.create({ data: { itineraryId: id, name: destinationName, order: await tx.destination.count({ where: { itineraryId: id } }) } })
      const last = await tx.destItem.aggregate({ where: { destinationId: dest.id }, _max: { order: true, groupIndex: true } })
      const zeroBased = await tx.destItem.count({ where: { destinationId: dest.id, dayIndex: 0, type: { not: 'hotel' } } })
      if (zeroBased) await tx.destItem.updateMany({ where: { destinationId: dest.id, dayIndex: { not: null } }, data: { dayIndex: { increment: 1 } } })
      await tx.destItem.create({ data: { id: clientId, destinationId: dest.id, name, type, placeId: placeId ?? null, notes: notes || null,
        rating: rating || null, planningStatus: status, mealType: type === 'food_drink' ? mealType || null : null, tags, photoUrls, photoUrl: photoUrls[0] ?? null,
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
    const rating = form.has('rating') ? Number(form.get('rating')) : undefined
    if (rating !== undefined && (!Number.isInteger(rating) || rating < 0 || rating > 5)) throw new InputError('Choose a rating from 1 to 5, or leave it blank.')
    const day = text(form, 'day', 4)
    // The rest match the trip editor's fields; each is only changed when the form sends it.
    const extra: { type?: string; groupIndex?: number; mealType?: string | null; tags?: string[]; alternative?: string | null; description?: string | null; link?: string | null; address?: string | null; photoUrls?: string[]; photoUrl?: string | null } = {}
    // Category can be corrected (e.g. a restaurant posted as an activity from a snapshot).
    const nextType = form.has('category') ? text(form, 'category', 20) : ''
    const nextDestination = form.has('destination') ? text(form, 'destination', 160) : ''
    if (nextType && !['hotel', 'food_drink', 'activity', 'transport'].includes(nextType)) throw new InputError('Choose a category.')
    if (form.has('mealType')) {
      const mealType = text(form, 'mealType', 100)
      if (mealType && mealType.split(',').some(value => !MEAL_TYPES.includes(value))) throw new InputError('Choose a meal type from the available tags.')
      extra.mealType = mealType || null
    }
    if (form.has('tags')) extra.tags = stringList(form, 'tags', 40, 100)
    if (form.has('alternative')) extra.alternative = text(form, 'alternative', 240) || null
    if (form.has('description')) extra.description = text(form, 'description', 8000) || null
    if (form.has('address')) extra.address = text(form, 'address', 500) || null
    if (form.has('link')) {
      const link = text(form, 'link', 2048)
      if (link && !/^https?:\/\//i.test(link)) throw new InputError('Enter a website link starting with http:// or https://.')
      extra.link = link || null
    }
    if (form.has('photos')) {
      const photoUrls = stringList(form, 'photos', 20, 4096)
      if (photoUrls.some(url => !/^(https:\/\/|\/(?!\/))/.test(url))) throw new InputError('Please choose valid photos.')
      extra.photoUrls = photoUrls; extra.photoUrl = photoUrls[0] ?? null
    }
    if (!name || !['considering', 'booked', 'visited'].includes(status)) return { error: 'Enter a place name and choose a status.' }
    if (day && (!/^\d+$/.test(day) || Number(day) < 1 || Number(day) > 365)) return { error: 'Choose a day from 1 to 365, or leave it unscheduled.' }
    const owned = { id: itemId, destination: { itinerary: { userId } } }
    const item = await prisma.destItem.findFirst({ where: owned, select: { name: true, type: true, placeId: true, destinationId: true, destination: { select: { itineraryId: true, name: true, country: true } } } })
    if (!item) return { error: unavailable }
    if (nextType && nextType !== item.type) {
      extra.type = nextType
      // Hotels each get their own stay group; meal types only apply to restaurants.
      if (nextType === 'hotel') { const last = await prisma.destItem.aggregate({ where: { destinationId: item.destinationId }, _max: { groupIndex: true } }); extra.groupIndex = (last._max.groupIndex ?? -1) + 1 } else extra.groupIndex = 0
      if (nextType !== 'food_drink') extra.mealType = null
    }
    const nextPlaceId = placeId === undefined ? (name === item.name ? item.placeId : null) : placeId
    const identityChanged = nextPlaceId !== item.placeId || name !== item.name
    const moving = !!nextDestination && !samePlanDestination(item.destination, { name: nextDestination })
    await prisma.$transaction(async tx => {
      // Moving to another destination: an existing one with that name, or a new one at the end of the trip.
      let moveTo: { destinationId: string; order: number; groupIndex?: number } | null = null
      if (moving) {
        const tripId = item.destination.itineraryId
        const destinations = await tx.destination.findMany({ where: { itineraryId: tripId }, orderBy: { order: 'asc' } })
        const target = destinations.find(d => samePlanDestination(d, { name: nextDestination }))
          ?? await tx.destination.create({ data: { itineraryId: tripId, name: nextDestination, order: Math.max(-1, ...destinations.map(d => d.order)) + 1 } })
        const last = await tx.destItem.aggregate({ where: { destinationId: target.id }, _max: { order: true, groupIndex: true } })
        moveTo = { destinationId: target.id, order: (last._max.order ?? -1) + 1, ...((extra.type ?? item.type) === 'hotel' ? { groupIndex: (last._max.groupIndex ?? -1) + 1 } : {}) }
      }
      for (const destinationId of new Set([item.destinationId, moveTo?.destinationId].filter((id): id is string => !!id))) {
        const zeroBased = await tx.destItem.count({ where: { destinationId, dayIndex: 0, type: { not: 'hotel' } } })
        if (zeroBased) await tx.destItem.updateMany({ where: { destinationId, dayIndex: { not: null } }, data: { dayIndex: { increment: 1 } } })
      }
      const result = await tx.destItem.updateMany({ where: owned, data: { name, placeId: nextPlaceId, ...(identityChanged ? { lat: null, lng: null, address: null, link: null, description: null } : {}), ...extra, ...(moveTo ?? {}), notes: notes || null, ...(rating === undefined ? {} : { rating: rating || null }), planningStatus: status, dayIndex: day ? Number(day) : null } })
      if (!result.count) throw new InputError(unavailable)
      // Snapshots of this place show its corrected category too.
      if (extra.type) await tx.story.updateMany({ where: { sourceItemId: itemId, userId }, data: { type: extra.type } })
      // The destination it left goes away once it's empty, unless it has its own notes.
      if (moveTo) await tx.destination.deleteMany({ where: { id: item.destinationId, notes: null, items: { none: {} } } })
    })
    refresh(item.destination.itineraryId, userId)
    return { success: true }
  } catch (error) { return message(error) }
}

type PublishFormat = 'guide' | 'day-trip' | 'itinerary'
type PublishDetails = { budget?: number; tripRating?: number; tags?: string[]; bestMonths?: string[] }
// The post type, duration, budget, rating and tags a plan gets when posted; also saved ahead of time
// so the preview shows the trip exactly as it will be posted.
function publishFields(format: PublishFormat, details: PublishDetails, durationDays: number | null) {
  const budget = details.budget && details.budget >= 1 && details.budget <= 5 ? Math.floor(details.budget) : null
  const tripRating = details.tripRating && details.tripRating >= 1 && details.tripRating <= 5 ? Math.floor(details.tripRating) : null
  const tags = Array.isArray(details.tags) ? [...new Set(details.tags.filter(tag => typeof tag === 'string').slice(0, 20))] : []
  return { postType: format, durationDays: format === 'day-trip' ? 1 : format === 'guide' ? null : durationDays, budget, tripRating, tags: format === 'day-trip' ? [...new Set(['day-trip', ...tags])] : tags,
    ...(details.bestMonths === undefined ? {} : { bestMonths: bestMonths(details.bestMonths) }) }
}

// "A few more details" → Continue: save the details on the still-private plan, before previewing it.
export async function savePublishDetails(id: string, format: PublishFormat = 'itinerary', details: PublishDetails = {}): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (!['guide', 'day-trip', 'itinerary'].includes(format)) return { error: 'Choose a trip type.' }
  try {
    const trip = await prisma.itinerary.findFirst({ where: { id, userId, visibility: 'draft', destinations: { some: { items: { some: {} } } } }, select: { durationDays: true } })
    if (!trip) return { error: 'Add at least one place before posting your trip.' }
    await prisma.itinerary.updateMany({ where: { id, userId, visibility: 'draft' }, data: publishFields(format, details, trip.durationDays) })
    refresh(id, userId)
    return { success: true }
  } catch { return { error: 'Could not save these details. Please try again.' } }
}

export async function sharePlan(id: string, format: PublishFormat = 'itinerary', details: PublishDetails = {}): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  try {
    const trip = await prisma.itinerary.findFirst({ where: { id, userId, destinations: { some: { items: { some: {} } } } }, select: { id: true, durationDays: true } })
    if (!trip) return { error: 'Add at least one place before sharing your trip.' }
    const result = await prisma.itinerary.updateMany({ where: { id, userId, visibility: 'draft' }, data: { visibility: 'public', publishedAt: new Date(), ...publishFields(format, details, trip.durationDays) } })
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

// Private plans offered by the Post button, newest first, with how many places each has.
export async function plansForPosting() {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in to post a trip.', plans: [] }
  const trips = await prisma.itinerary.findMany({ where: { userId, visibility: 'draft' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, title: true, isPlan: true, destinations: { select: { _count: { select: { items: true } } } } } })
  return { plans: trips.map(trip => ({ id: trip.id, title: trip.title || 'Untitled trip', isPlan: trip.isPlan, places: trip.destinations.reduce((sum, destination) => sum + destination._count.items, 0) })) }
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
      let destination = (await tx.destination.findMany({ where: { itineraryId: planId }, orderBy: { order: 'asc' } })).find(existing => samePlanDestination(existing, source.destination)) ?? null
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
