'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type ItineraryState = { error?: string } | undefined

type DestInput = {
  name: string
  country: string
  items: { type: string; name: string; notes: string; rating: number; link: string }[]
}

function parseFormData(formData: FormData) {
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const startDateStr = formData.get('startDate') as string
  const endDateStr = formData.get('endDate') as string
  const audience = (formData.get('audience') as string) || 'family'
  const visibility = (formData.get('visibility') as string) || 'public'
  const notes = (formData.get('notes') as string)?.trim() || null
  const destinations: DestInput[] = formData.get('destinations')
    ? JSON.parse(formData.get('destinations') as string)
    : []
  const photos: { url: string; caption: string }[] = formData.get('photos')
    ? JSON.parse(formData.get('photos') as string)
    : []
  return { title, description, startDateStr, endDateStr, audience, visibility, notes, destinations, photos }
}

export async function createItinerary(
  state: ItineraryState,
  formData: FormData
): Promise<ItineraryState> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'You must be logged in.' }

  const { title, description, startDateStr, endDateStr, audience, visibility, notes, destinations, photos } =
    parseFormData(formData)

  if (!title) return { error: 'Title is required.' }
  if (!startDateStr || !endDateStr) return { error: 'Start and end dates are required.' }

  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)
  if (endDate < startDate) return { error: 'End date must be after start date.' }

  const itinerary = await prisma.itinerary.create({
    data: {
      title,
      description,
      startDate,
      endDate,
      audience,
      visibility,
      notes,
      userId: session.user.id,
      destinations: {
        create: destinations.map((d, i) => ({
          name: d.name,
          country: d.country || null,
          order: i,
          items: {
            create: d.items
              .filter((item) => item.name.trim())
              .map((item) => ({
                type: item.type,
                name: item.name.trim(),
                notes: item.notes.trim() || null,
                rating: item.rating > 0 ? item.rating : null,
                link: item.link?.trim() || null,
              })),
          },
        })),
      },
      photos: {
        create: photos.map((p) => ({ url: p.url, caption: p.caption || null })),
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

  const { title, description, startDateStr, endDateStr, audience, visibility, notes, destinations, photos } =
    parseFormData(formData)

  if (!title) return { error: 'Title is required.' }
  if (!startDateStr || !endDateStr) return { error: 'Start and end dates are required.' }

  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)
  if (endDate < startDate) return { error: 'End date must be after start date.' }

  // Delete existing destinations (cascades to items) and photos, then recreate
  await prisma.destination.deleteMany({ where: { itineraryId: id } })
  await prisma.photo.deleteMany({ where: { itineraryId: id } })

  await prisma.itinerary.update({
    where: { id },
    data: {
      title,
      description,
      startDate,
      endDate,
      audience,
      visibility,
      notes,
      destinations: {
        create: destinations.map((d, i) => ({
          name: d.name,
          country: d.country || null,
          order: i,
          items: {
            create: d.items
              .filter((item) => item.name.trim())
              .map((item) => ({
                type: item.type,
                name: item.name.trim(),
                notes: item.notes.trim() || null,
                rating: item.rating > 0 ? item.rating : null,
                link: item.link?.trim() || null,
              })),
          },
        })),
      },
      photos: {
        create: photos.map((p) => ({ url: p.url, caption: p.caption || null })),
      },
    },
  })

  revalidatePath('/')
  revalidatePath(`/itinerary/${id}`)
  redirect(`/itinerary/${id}`)
}
