'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { fetchStockPhoto } from '@/lib/stockPhoto'
import { generateTags } from '@/lib/generateTags'
import { geocode, geocodePlaceByName } from '@/lib/geocode'
import { inferPlaceAttributes } from '@/lib/inferPriceLevels'
import { generateDescriptions } from '@/lib/generateDescriptions'

export type ItineraryState = { error?: string } | undefined

type FoodInput = { name: string; mealType?: string; description?: string; notes: string; rating: number; link: string; priceLevel?: number | null; familyFriendly?: boolean | null; familyFriendlySource?: string | null; lat?: number | null; lng?: number | null; tags?: string[]; dayIndex?: number | null; order?: number }
type ActivityInput = { name: string; notes: string; rating: number; link: string; dayIndex?: number | null; order?: number; tags?: string[] }
type DayInput = { dayIndex?: number; food: FoodInput[]; activities: ActivityInput[] }
type StayGroup = {
  hotelName: string; hotelDescription?: string; hotelNotes: string; hotelAddress?: string; hotelLink: string; hotelRating: number; hotelPriceLevel?: number | null; hotelLat?: number | null; hotelLng?: number | null; hotelTags?: string[]
  days?: DayInput[]      // new format: days with food and activities
  food?: FoodInput[]; activities?: ActivityInput[]  // legacy: flat (used by guided flow)
}
type DestInput = { name: string; country: string; notes: string; groups: StayGroup[] }

type ItemRow = { type: string; name: string; description: string | null; notes: string | null; address: string | null; link: string | null; rating: number | null; priceLevel: number | null; familyFriendly: boolean | null; familyFriendlySource: string | null; mealType: string | null; groupIndex: number; dayIndex: number | null; order: number; lat: number | null; lng: number | null; tags: string[] }

// Cap any promise at ms milliseconds — resolves to null on timeout
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))])
}

function flattenGroups(groups: StayGroup[]): ItemRow[] {
  return groups.flatMap((g, gi) => {
    const rows: ItemRow[] = []
    if (g.hotelName?.trim()) {
      rows.push({ type: 'hotel', name: g.hotelName.trim(), description: g.hotelDescription?.trim() || null, notes: g.hotelNotes?.trim() || null, address: g.hotelAddress?.trim() || null, link: g.hotelLink?.trim() || null, rating: g.hotelRating > 0 ? g.hotelRating : null, priceLevel: g.hotelPriceLevel ?? null, familyFriendly: null, familyFriendlySource: null, mealType: null, groupIndex: gi, dayIndex: null, order: 0, lat: g.hotelLat ?? null, lng: g.hotelLng ?? null, tags: g.hotelTags ?? [] })
    }
    if (g.days) {
      for (const [dyi, day] of g.days.entries()) {
        const dayIndex = day.dayIndex ?? (dyi + 1)
        for (const [fi, f] of (day.food ?? []).entries()) {
          if (f.name?.trim()) rows.push({ type: 'food_drink', name: f.name.trim(), description: f.description?.trim() || null, notes: f.notes?.trim() || null, address: null, link: f.link?.trim() || null, rating: f.rating > 0 ? f.rating : null, priceLevel: f.priceLevel ?? null, familyFriendly: f.familyFriendly ?? null, familyFriendlySource: f.familyFriendlySource ?? null, mealType: f.mealType?.trim() || null, groupIndex: gi, dayIndex, order: f.order ?? fi, lat: f.lat ?? null, lng: f.lng ?? null, tags: f.tags ?? [] })
        }
        for (const [ai, a] of (day.activities ?? []).entries()) {
          if (a.name?.trim()) rows.push({ type: 'activity', name: a.name.trim(), description: null, notes: a.notes?.trim() || null, address: null, link: a.link?.trim() || null, rating: a.rating > 0 ? a.rating : null, priceLevel: null, familyFriendly: null, familyFriendlySource: null, mealType: null, groupIndex: gi, dayIndex, order: a.order ?? ((day.food?.length ?? 0) + ai), lat: null, lng: null, tags: a.tags ?? [] })
        }
      }
    } else {
      for (const [fi, f] of (g.food ?? []).entries()) {
        if (f.name?.trim()) rows.push({ type: 'food_drink', name: f.name.trim(), description: f.description?.trim() || null, notes: f.notes?.trim() || null, address: null, link: f.link?.trim() || null, rating: f.rating > 0 ? f.rating : null, priceLevel: f.priceLevel ?? null, familyFriendly: f.familyFriendly ?? null, familyFriendlySource: f.familyFriendlySource ?? null, mealType: f.mealType?.trim() || null, groupIndex: gi, dayIndex: f.dayIndex ?? null, order: fi, lat: f.lat ?? null, lng: f.lng ?? null, tags: f.tags ?? [] })
      }
      for (const [ai, a] of (g.activities ?? []).entries()) {
        if (a.name?.trim()) rows.push({ type: 'activity', name: a.name.trim(), description: null, notes: a.notes?.trim() || null, address: null, link: a.link?.trim() || null, rating: a.rating > 0 ? a.rating : null, priceLevel: null, familyFriendly: null, familyFriendlySource: null, mealType: null, groupIndex: gi, dayIndex: a.dayIndex ?? null, order: (g.food?.length ?? 0) + ai, lat: null, lng: null, tags: a.tags ?? [] })
      }
    }
    return rows
  })
}

function parseFormData(formData: FormData) {
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const startDateStr = formData.get('startDate') as string
  const endDateStr = formData.get('endDate') as string
  const postType = (formData.get('postType') as string) || 'itinerary'
  const audience = (formData.get('audience') as string) || 'family'
  const isDraft = formData.get('isDraft') === '1'
  const visibility = isDraft ? 'draft' : 'public'
  const notes = (formData.get('notes') as string)?.trim() || null
  const highlights = (formData.get('highlights') as string)?.trim() || null
  const tags: string[] = formData.get('tags') ? JSON.parse(formData.get('tags') as string) : []
  const budgetRaw = parseInt(formData.get('budget') as string)
  const budget = budgetRaw >= 1 && budgetRaw <= 4 ? budgetRaw : null
  const tripRatingRaw = parseInt(formData.get('tripRating') as string)
  const tripRating = tripRatingRaw >= 1 && tripRatingRaw <= 5 ? tripRatingRaw : null
  const destinations: DestInput[] = formData.get('destinations')
    ? JSON.parse(formData.get('destinations') as string)
    : []
  const photos: { url: string; caption: string }[] = formData.get('photos')
    ? JSON.parse(formData.get('photos') as string)
    : []
  return { postType, title, description, startDateStr, endDateStr, audience, visibility, isDraft, notes, highlights, tags, budget, tripRating, destinations, photos }
}

async function generateMissingDescriptions(itineraryId: string): Promise<void> {
  const items = await prisma.destItem.findMany({
    where: {
      destination: { itineraryId },
      type: { in: ['hotel', 'food_drink'] },
      description: null,
      name: { not: '' },
      // Only generate descriptions for places confirmed via Google Places API
      // (lat is set by fetchItemPriceLevel/fetchHotelPriceLevel after autocomplete selection).
      // Manually typed names and raw addresses have lat: null — skip those.
      lat: { not: null },
    },
    include: { destination: { select: { name: true, country: true } } },
  })
  if (items.length === 0) return
  const descriptionMap = await generateDescriptions(
    items.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type as 'hotel' | 'food_drink',
      destination: [item.destination.name, item.destination.country].filter(Boolean).join(', '),
      mealType: item.mealType,
      priceLevel: item.priceLevel,
    }))
  )
  for (const item of items) {
    const description = descriptionMap.get(item.id)
    if (description) {
      await prisma.destItem.update({ where: { id: item.id }, data: { description } })
    }
  }
}

async function inferMissingAttributes(itineraryId: string): Promise<void> {
  const items = await prisma.destItem.findMany({
    where: {
      destination: { itineraryId },
      type: { in: ['hotel', 'food_drink'] },
      OR: [{ priceLevel: null }, { type: 'food_drink', familyFriendly: null }],
      name: { not: '' },
    },
    include: { destination: { select: { name: true, country: true } } },
  })
  if (items.length === 0) return
  const { priceLevels, familyFriendly } = await inferPlaceAttributes(
    items.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type as 'hotel' | 'food_drink',
      destination: [item.destination.name, item.destination.country].filter(Boolean).join(', '),
    }))
  )
  for (const item of items) {
    const priceLevel = priceLevels.get(item.id)
    const ff = familyFriendly.get(item.id)
    const data: { priceLevel?: number; familyFriendly?: boolean; familyFriendlySource?: string } = {}
    if (priceLevel !== undefined && item.priceLevel === null) data.priceLevel = priceLevel
    if (ff !== undefined && item.type === 'food_drink' && item.familyFriendly === null) {
      data.familyFriendly = ff
      data.familyFriendlySource = 'llm'
    }
    if (Object.keys(data).length > 0) {
      await prisma.destItem.update({ where: { id: item.id }, data })
    }
  }
}

async function geocodeItineraryDests(itineraryId: string): Promise<void> {
  const dests = await prisma.destination.findMany({
    where: { itineraryId },
    select: { id: true, name: true, country: true },
  })
  for (const dest of dests) {
    const query = `${dest.name}${dest.country ? `, ${dest.country}` : ''}`
    const coords = await geocode(query)
    if (coords) {
      await prisma.destination.update({ where: { id: dest.id }, data: coords })
    }
  }
}

// Geocodes individual items (hotels, restaurants, activities) that have no coordinates yet.
// Uses Google Places Text Search with destination context to disambiguate — e.g.
// "The Edition, Rome, Italy" — so imported itineraries appear as map pins immediately.
async function geocodeItineraryItems(itineraryId: string): Promise<void> {
  const items = await prisma.destItem.findMany({
    where: {
      destination: { itineraryId },
      lat: null,
      name: { not: '' },
    },
    select: {
      id: true,
      name: true,
      destination: { select: { name: true, country: true } },
    },
  })
  for (const item of items) {
    const query = [item.name, item.destination.name, item.destination.country].filter(Boolean).join(', ')
    const coords = await geocodePlaceByName(query)
    if (coords) {
      await prisma.destItem.update({ where: { id: item.id }, data: coords })
    }
  }
}

export async function createItinerary(
  state: ItineraryState,
  formData: FormData
): Promise<ItineraryState> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'You must be logged in.' }

  const { postType, title, description, startDateStr, endDateStr, audience, visibility, isDraft, notes, highlights, tags, budget, tripRating, destinations, photos } =
    parseFormData(formData)

  // Dates required for itineraries — unless saving as draft
  const isGuide = postType === 'guide'
  if (!isDraft && !title.trim()) return { error: 'Add a title before publishing.' }
  if (!isDraft && !isGuide && (!startDateStr || !endDateStr)) return { error: 'Add a month and number of days before publishing.' }

  const today = new Date()
  const startDate = startDateStr ? new Date(startDateStr) : today
  const endDate = endDateStr ? new Date(endDateStr) : today
  if (!isDraft && endDate < startDate) return { error: 'End date must be after start date.' }

  // Publishing requires at least one item
  if (!isDraft) {
    if (!destinations.some((destination) => destination.name.trim())) return { error: 'Add at least one destination before publishing.' }
    const totalItems = destinations.flatMap(d => flattenGroups(d.groups ?? [])).length
    if (totalItems === 0) return { error: 'Add at least one hotel, restaurant, or activity before publishing.' }
  }

  // Save itinerary first — stock photo fetch happens after so a slow API
  // can never prevent the itinerary from being saved
  const itinerary = await prisma.itinerary.create({
    data: {
      postType,
      title,
      description,
      startDate,
      endDate,
      audience,
      visibility,
      notes,
      highlights,
      tags,
      budget,
      tripRating,
      userId: session.user.id,
      destinations: {
        create: destinations.map((d, i) => ({
          name: d.name,
          country: d.country || null,
          notes: d.notes?.trim() || null,
          order: i,
          items: { create: flattenGroups(d.groups ?? []) },
        })),
      },
      photos: {
        create: photos.map((p) => ({ url: p.url, caption: p.caption || null, isStock: false })),
      },
    },
  })

  // Run stock photo fetch, tag generation, geocoding, price level inference, and description generation in parallel after save
  // Each task is wrapped in .catch(() => null) so a failure in any background task doesn't block the redirect.
  // The whole block is capped at 20 s so a stalled API can never hang the publish button.
  await withTimeout(Promise.all([
    photos.length === 0 && destinations.length > 0
      ? fetchStockPhoto(`${destinations[0].name}${destinations[0].country ? ` ${destinations[0].country}` : ''} travel`)
          .then((url) => url ? prisma.photo.create({ data: { url, isStock: true, itineraryId: itinerary.id } }) : null)
          .catch(() => null)
      : null,
    tags.length === 0
      ? generateTags(title, destinations.map((d) => ({
          name: d.name,
          country: d.country || null,
          items: (d.groups ?? []).flatMap((g) => [
            ...(g.hotelName?.trim() ? [{ type: 'hotel', name: g.hotelName.trim(), notes: g.hotelNotes?.trim() || null }] : []),
            ...(g.days ?? []).flatMap(day => [
              ...day.food.filter(f => f.name?.trim()).map(f => ({ type: 'food_drink', name: f.name.trim(), notes: f.notes?.trim() || null })),
              ...day.activities.filter(a => a.name?.trim()).map(a => ({ type: 'activity', name: a.name.trim(), notes: a.notes?.trim() || null })),
            ]),
            ...(g.food ?? []).filter((f) => f.name?.trim()).map((f) => ({ type: 'food_drink', name: f.name.trim(), notes: f.notes?.trim() || null })),
            ...(g.activities ?? []).filter((a) => a.name?.trim()).map((a) => ({ type: 'activity', name: a.name.trim(), notes: a.notes?.trim() || null })),
          ]),
        })), audience)
          .then((autoTags) => autoTags.length > 0 ? prisma.itinerary.update({ where: { id: itinerary.id }, data: { tags: autoTags } }) : null)
          .catch(() => null)
      : null,
    geocodeItineraryDests(itinerary.id).catch(() => null),
    geocodeItineraryItems(itinerary.id).catch(() => null),
    inferMissingAttributes(itinerary.id).catch(() => null),
    generateMissingDescriptions(itinerary.id).catch(() => null),
  ]), 20000)

  revalidatePath('/')
  redirect(`/itinerary/${itinerary.id}`)
}

export async function createItineraryDirect(input: {
  title: string; description: string; startDate: string; endDate: string
  postType: string; audience: string; visibility: string; isDraft: boolean
  notes: string; highlights: string; tags: string[]; tripRating?: number | null
  destinations: DestInput[]; photos: { url: string; caption: string }[]
}): Promise<ItineraryState> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'You must be logged in.' }

  const { title, description, startDate: startDateStr, endDate: endDateStr, postType, audience, isDraft, notes, highlights, tags, tripRating, destinations, photos } = input
  const visibility = isDraft ? 'draft' : 'public'

  const resolvedTitle = title?.trim() || ''

  const today = new Date()
  const startDate = startDateStr ? new Date(startDateStr) : today
  const endDate = endDateStr ? new Date(endDateStr) : today
  if (startDateStr && endDateStr && endDate < startDate) return { error: 'End date must be after start date.' }

  if (!isDraft) {
    if (!resolvedTitle) return { error: 'Add a title before publishing.' }
    if (!destinations.some((destination) => destination.name.trim())) return { error: 'Add at least one destination before publishing.' }
    if (postType !== 'guide' && (!startDateStr || !endDateStr)) return { error: 'Add a month and number of days before publishing.' }
    const totalItems = destinations.flatMap(d => flattenGroups(d.groups ?? [])).length
    if (totalItems === 0) return { error: 'Add at least one hotel, restaurant, or activity before publishing.' }
  }

  const itinerary = await prisma.itinerary.create({
    data: {
      postType, title: resolvedTitle, description: description?.trim() || null,
      startDate, endDate, audience, visibility,
      notes: notes?.trim() || null, highlights: highlights?.trim() || null, tags, budget: null,
      tripRating: tripRating ?? null,
      userId: session.user.id,
      destinations: { create: destinations.map((d, i) => ({ name: d.name, country: d.country || null, notes: d.notes?.trim() || null, order: i, items: { create: flattenGroups(d.groups ?? []) } })) },
      photos: { create: photos.map((p) => ({ url: p.url, caption: p.caption || null, isStock: false })) },
    },
  })

  await withTimeout(Promise.all([
    photos.length === 0 && destinations.length > 0
      ? fetchStockPhoto(`${destinations[0].name}${destinations[0].country ? ` ${destinations[0].country}` : ''} travel`)
          .then((url) => url ? prisma.photo.create({ data: { url, isStock: true, itineraryId: itinerary.id } }) : null)
          .catch(() => null)
      : null,
    tags.length === 0
      ? generateTags(resolvedTitle, destinations.map((d) => ({
          name: d.name, country: d.country || null,
          items: (d.groups ?? []).flatMap((g) => [
            ...(g.hotelName?.trim() ? [{ type: 'hotel', name: g.hotelName.trim(), notes: g.hotelNotes?.trim() || null }] : []),
            ...(g.days ?? []).flatMap(day => [
              ...day.food.filter(f => f.name?.trim()).map(f => ({ type: 'food_drink', name: f.name.trim(), notes: f.notes?.trim() || null })),
              ...day.activities.filter(a => a.name?.trim()).map(a => ({ type: 'activity', name: a.name.trim(), notes: a.notes?.trim() || null })),
            ]),
            ...(g.food ?? []).filter((f) => f.name?.trim()).map((f) => ({ type: 'food_drink', name: f.name.trim(), notes: f.notes?.trim() || null })),
            ...(g.activities ?? []).filter((a) => a.name?.trim()).map((a) => ({ type: 'activity', name: a.name.trim(), notes: a.notes?.trim() || null })),
          ]),
        })), audience)
          .then((autoTags) => autoTags.length > 0 ? prisma.itinerary.update({ where: { id: itinerary.id }, data: { tags: autoTags } }) : null)
          .catch(() => null)
      : null,
    geocodeItineraryDests(itinerary.id).catch(() => null),
    geocodeItineraryItems(itinerary.id).catch(() => null),
    inferMissingAttributes(itinerary.id).catch(() => null),
    generateMissingDescriptions(itinerary.id).catch(() => null),
  ]), 20000)

  revalidatePath('/')
  redirect(`/itinerary/${itinerary.id}`)
}

export async function updateItinerary(
  id: string,
  state: ItineraryState,
  formData: FormData
): Promise<ItineraryState> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'You must be logged in.' }

  const existing = await prisma.itinerary.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) return { error: 'Not found.' }

  const { postType, title, description, startDateStr, endDateStr, audience, visibility, isDraft, notes, highlights, tags, budget, tripRating, destinations, photos } =
    parseFormData(formData)

  if (!title) return { error: 'Title is required.' }

  const isGuide = postType === 'guide'
  if (!isDraft && !isGuide && (!startDateStr || !endDateStr)) return { error: 'Start and end dates are required.' }

  const today = new Date()
  const startDate = startDateStr ? new Date(startDateStr) : today
  const endDate = endDateStr ? new Date(endDateStr) : today
  if (!isDraft && endDate < startDate) return { error: 'End date must be after start date.' }

  // Publishing requires at least one item
  if (!isDraft) {
    const totalItems = destinations.flatMap(d => flattenGroups(d.groups ?? [])).length
    if (totalItems === 0) return { error: 'Add at least one hotel, restaurant, or activity before publishing.' }
  }

  // Delete existing destinations (cascades to items) and photos, then recreate
  await prisma.destination.deleteMany({ where: { itineraryId: id } })
  await prisma.photo.deleteMany({ where: { itineraryId: id } })
  revalidatePath(`/itinerary/${id}`)

  await prisma.itinerary.update({
    where: { id },
    data: {
      postType,
      title,
      description,
      startDate,
      endDate,
      audience,
      visibility,
      notes,
      highlights,
      tags,
      budget,
      tripRating,
      destinations: {
        create: destinations.map((d, i) => ({
          name: d.name,
          country: d.country || null,
          notes: d.notes?.trim() || null,
          order: i,
          items: { create: flattenGroups(d.groups ?? []) },
        })),
      },
      photos: {
        create: photos.map((p) => ({ url: p.url, caption: p.caption || null, isStock: false })),
      },
    },
  })

  // Fetch stock photo, geocode destinations, infer missing price levels, and generate descriptions after save
  await withTimeout(Promise.all([
    photos.length === 0 && destinations.length > 0
      ? fetchStockPhoto(`${destinations[0].name}${destinations[0].country ? ` ${destinations[0].country}` : ''} travel`)
          .then((url) => url ? prisma.photo.create({ data: { url, isStock: true, itineraryId: id } }) : null)
          .catch(() => null)
      : null,
    geocodeItineraryDests(id).catch(() => null),
    geocodeItineraryItems(id).catch(() => null),
    inferMissingAttributes(id).catch(() => null),
    generateMissingDescriptions(id).catch(() => null),
  ]), 20000)

  revalidatePath('/')
  revalidatePath(`/itinerary/${id}`)
  redirect(`/itinerary/${id}`)
}

export async function deleteItinerary(id: string): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'You must be logged in.' }

  const existing = await prisma.itinerary.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) return { error: 'Not found.' }

  await prisma.itinerary.delete({ where: { id } })
  revalidatePath('/')
  revalidatePath(`/user/${session.user.id}`)
  redirect('/')
}
