'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { fetchStockPhoto } from '@/lib/stockPhoto'
import { generateTags } from '@/lib/generateTags'
import { geocode } from '@/lib/geocode'

export type ItineraryState = { error?: string } | undefined

type FoodInput = { name: string; mealType?: string; notes: string; rating: number; link: string }
type ActivityInput = { name: string; notes: string; rating: number; link: string }
type StayGroup = {
  hotelName: string; hotelNotes: string; hotelAddress: string; hotelLink: string; hotelRating: number; hotelPriceLevel?: number | null
  food: FoodInput[]; activities: ActivityInput[]
}
type DestInput = { name: string; country: string; notes: string; groups: StayGroup[] }

type ItemRow = { type: string; name: string; notes: string | null; address: string | null; link: string | null; rating: number | null; priceLevel: number | null; mealType: string | null; groupIndex: number }

function flattenGroups(groups: StayGroup[]): ItemRow[] {
  return groups.flatMap((g, gi) => {
    const rows: ItemRow[] = []
    if (g.hotelName?.trim()) {
      rows.push({ type: 'hotel', name: g.hotelName.trim(), notes: g.hotelNotes?.trim() || null, address: g.hotelAddress?.trim() || null, link: g.hotelLink?.trim() || null, rating: g.hotelRating > 0 ? g.hotelRating : null, priceLevel: g.hotelPriceLevel ?? null, mealType: null, groupIndex: gi })
    }
    for (const f of g.food ?? []) {
      if (f.name?.trim()) rows.push({ type: 'food_drink', name: f.name.trim(), notes: f.notes?.trim() || null, address: null, link: f.link?.trim() || null, rating: f.rating > 0 ? f.rating : null, priceLevel: null, mealType: f.mealType?.trim() || null, groupIndex: gi })
    }
    for (const a of g.activities ?? []) {
      if (a.name?.trim()) rows.push({ type: 'activity', name: a.name.trim(), notes: a.notes?.trim() || null, address: null, link: a.link?.trim() || null, rating: a.rating > 0 ? a.rating : null, priceLevel: null, mealType: null, groupIndex: gi })
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
  const visibility = isDraft ? 'draft' : ((formData.get('visibility') as string) || 'public')
  const notes = (formData.get('notes') as string)?.trim() || null
  const highlights = (formData.get('highlights') as string)?.trim() || null
  const tags: string[] = formData.get('tags') ? JSON.parse(formData.get('tags') as string) : []
  const budgetRaw = parseInt(formData.get('budget') as string)
  const budget = budgetRaw >= 1 && budgetRaw <= 5 ? budgetRaw : null
  const destinations: DestInput[] = formData.get('destinations')
    ? JSON.parse(formData.get('destinations') as string)
    : []
  const photos: { url: string; caption: string }[] = formData.get('photos')
    ? JSON.parse(formData.get('photos') as string)
    : []
  return { postType, title, description, startDateStr, endDateStr, audience, visibility, isDraft, notes, highlights, tags, budget, destinations, photos }
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

export async function createItinerary(
  state: ItineraryState,
  formData: FormData
): Promise<ItineraryState> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'You must be logged in.' }

  const { postType, title, description, startDateStr, endDateStr, audience, visibility, isDraft, notes, highlights, tags, budget, destinations, photos } =
    parseFormData(formData)

  if (!title) return { error: 'Title is required.' }

  // Dates required for itineraries — unless saving as draft
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

  // Run stock photo fetch, tag generation, and geocoding in parallel after save
  await Promise.all([
    photos.length === 0 && destinations.length > 0
      ? fetchStockPhoto(`${destinations[0].name}${destinations[0].country ? ` ${destinations[0].country}` : ''} travel`)
          .then((url) => url ? prisma.photo.create({ data: { url, isStock: true, itineraryId: itinerary.id } }) : null)
      : null,
    tags.length === 0
      ? generateTags(title, destinations.map((d) => ({
          name: d.name,
          country: d.country || null,
          items: (d.groups ?? []).flatMap((g) => [
            ...(g.hotelName?.trim() ? [{ type: 'hotel', name: g.hotelName.trim(), notes: g.hotelNotes?.trim() || null }] : []),
            ...(g.food ?? []).filter((f) => f.name?.trim()).map((f) => ({ type: 'food_drink', name: f.name.trim(), notes: f.notes?.trim() || null })),
            ...(g.activities ?? []).filter((a) => a.name?.trim()).map((a) => ({ type: 'activity', name: a.name.trim(), notes: a.notes?.trim() || null })),
          ]),
        })), audience)
          .then((autoTags) => autoTags.length > 0 ? prisma.itinerary.update({ where: { id: itinerary.id }, data: { tags: autoTags } }) : null)
      : null,
    geocodeItineraryDests(itinerary.id),
  ])

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

  const { postType, title, description, startDateStr, endDateStr, audience, visibility, isDraft, notes, highlights, tags, budget, destinations, photos } =
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

  // Fetch stock photo and geocode destinations after save
  await Promise.all([
    photos.length === 0 && destinations.length > 0
      ? fetchStockPhoto(`${destinations[0].name}${destinations[0].country ? ` ${destinations[0].country}` : ''} travel`)
          .then((url) => url ? prisma.photo.create({ data: { url, isStock: true, itineraryId: id } }) : null)
      : null,
    geocodeItineraryDests(id),
  ])

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
