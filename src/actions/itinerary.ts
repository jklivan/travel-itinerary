'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { fetchStockPhoto } from '@/lib/stockPhoto'

export type ItineraryState = { error?: string } | undefined

type FoodInput = { name: string; mealType?: string; notes: string; rating: number; link: string }
type ActivityInput = { name: string; notes: string; rating: number; link: string }
type StayGroup = {
  hotelName: string; hotelNotes: string; hotelLink: string; hotelRating: number
  food: FoodInput[]; activities: ActivityInput[]
}
type DestInput = { name: string; country: string; notes: string; groups: StayGroup[] }

type ItemRow = { type: string; name: string; notes: string | null; link: string | null; rating: number | null; mealType: string | null; groupIndex: number }

function flattenGroups(groups: StayGroup[]): ItemRow[] {
  return groups.flatMap((g, gi) => {
    const rows: ItemRow[] = []
    if (g.hotelName?.trim()) {
      rows.push({ type: 'hotel', name: g.hotelName.trim(), notes: g.hotelNotes?.trim() || null, link: g.hotelLink?.trim() || null, rating: g.hotelRating > 0 ? g.hotelRating : null, mealType: null, groupIndex: gi })
    }
    for (const f of g.food ?? []) {
      if (f.name?.trim()) rows.push({ type: 'food_drink', name: f.name.trim(), notes: f.notes?.trim() || null, link: f.link?.trim() || null, rating: f.rating > 0 ? f.rating : null, mealType: f.mealType?.trim() || null, groupIndex: gi })
    }
    for (const a of g.activities ?? []) {
      if (a.name?.trim()) rows.push({ type: 'activity', name: a.name.trim(), notes: a.notes?.trim() || null, link: a.link?.trim() || null, rating: a.rating > 0 ? a.rating : null, mealType: null, groupIndex: gi })
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
  const destinations: DestInput[] = formData.get('destinations')
    ? JSON.parse(formData.get('destinations') as string)
    : []
  const photos: { url: string; caption: string }[] = formData.get('photos')
    ? JSON.parse(formData.get('photos') as string)
    : []
  return { postType, title, description, startDateStr, endDateStr, audience, visibility, isDraft, notes, highlights, tags, destinations, photos }
}

export async function createItinerary(
  state: ItineraryState,
  formData: FormData
): Promise<ItineraryState> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'You must be logged in.' }

  const { postType, title, description, startDateStr, endDateStr, audience, visibility, isDraft, notes, highlights, tags, destinations, photos } =
    parseFormData(formData)

  if (!title) return { error: 'Title is required.' }

  // Dates required for itineraries — unless saving as draft
  const isGuide = postType === 'guide'
  if (!isDraft && !isGuide && (!startDateStr || !endDateStr)) return { error: 'Start and end dates are required.' }

  const today = new Date()
  const startDate = startDateStr ? new Date(startDateStr) : today
  const endDate = endDateStr ? new Date(endDateStr) : today
  if (!isDraft && endDate < startDate) return { error: 'End date must be after start date.' }

  // Fetch stock photo if user didn't upload one
  const photosToSave: { url: string; caption: string | null; isStock: boolean }[] =
    photos.map((p) => ({ url: p.url, caption: p.caption || null, isStock: false }))
  if (photosToSave.length === 0 && destinations.length > 0) {
    const query = `${destinations[0].name}${destinations[0].country ? ` ${destinations[0].country}` : ''} travel`
    const stockUrl = await fetchStockPhoto(query)
    if (stockUrl) photosToSave.push({ url: stockUrl, caption: null, isStock: true })
  }

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
        create: photosToSave,
      },
    },
  })

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

  const { postType, title, description, startDateStr, endDateStr, audience, visibility, isDraft, notes, highlights, tags, destinations, photos } =
    parseFormData(formData)

  if (!title) return { error: 'Title is required.' }

  const isGuide = postType === 'guide'
  if (!isDraft && !isGuide && (!startDateStr || !endDateStr)) return { error: 'Start and end dates are required.' }

  const today = new Date()
  const startDate = startDateStr ? new Date(startDateStr) : today
  const endDate = endDateStr ? new Date(endDateStr) : today
  if (!isDraft && endDate < startDate) return { error: 'End date must be after start date.' }

  // Delete existing destinations (cascades to items) and photos, then recreate
  await prisma.destination.deleteMany({ where: { itineraryId: id } })
  await prisma.photo.deleteMany({ where: { itineraryId: id } })
  revalidatePath(`/itinerary/${id}`)

  // Fetch stock photo if user didn't upload one
  const photosToSave: { url: string; caption: string | null; isStock: boolean }[] =
    photos.map((p) => ({ url: p.url, caption: p.caption || null, isStock: false }))
  if (photosToSave.length === 0 && destinations.length > 0) {
    const query = `${destinations[0].name}${destinations[0].country ? ` ${destinations[0].country}` : ''} travel`
    const stockUrl = await fetchStockPhoto(query)
    if (stockUrl) photosToSave.push({ url: stockUrl, caption: null, isStock: true })
  }

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
        create: photosToSave,
      },
    },
  })

  revalidatePath('/')
  revalidatePath(`/itinerary/${id}`)
  redirect(`/itinerary/${id}`)
}
