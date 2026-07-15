'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type ItineraryState = { error?: string } | undefined

export async function createItinerary(
  state: ItineraryState,
  formData: FormData
): Promise<ItineraryState> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'You must be logged in.' }

  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const startDateStr = formData.get('startDate') as string
  const endDateStr = formData.get('endDate') as string
  const budget = formData.get('budget') ? Number(formData.get('budget')) : null
  const currency = (formData.get('currency') as string) || 'USD'
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!title) return { error: 'Title is required.' }
  if (!startDateStr || !endDateStr) return { error: 'Start and end dates are required.' }

  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)
  if (endDate < startDate) return { error: 'End date must be after start date.' }

  // Destinations with nested items, encoded as JSON
  const destinationsJson = formData.get('destinations') as string
  const destinations: {
    name: string
    country: string
    items: { type: string; name: string; notes: string; rating: number }[]
  }[] = destinationsJson ? JSON.parse(destinationsJson) : []

  // Photos: URLs already uploaded, encoded as JSON
  const photosJson = formData.get('photos') as string
  const photos: { url: string; caption: string }[] = photosJson
    ? JSON.parse(photosJson)
    : []

  const itinerary = await prisma.itinerary.create({
    data: {
      title,
      description,
      startDate,
      endDate,
      budget,
      currency,
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
