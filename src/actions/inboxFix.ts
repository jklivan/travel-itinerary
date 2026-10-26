'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { inboxRefs } from '@/lib/inbox'
import { daysBetween } from '@/lib/placeDates'
import { startPlan } from '@/actions/planning'

// The reply to an emailed trip links here when Postcard filed it in the wrong trip: move the places that email added
// to another plan, make them a trip of their own, or remove them. Only the trip's owner, signed in, can do it.
type Result = { error?: string; planId?: string }
const validRef = (ref: unknown): ref is string => typeof ref === 'string' && /^[a-f0-9-]{36}$/.test(ref)

async function emailPlaces(ref: string, userId: string) {
  const refs = inboxRefs(ref)
  const items = await prisma.destItem.findMany({ where: { id: { startsWith: `${refs.import}:` }, destination: { itinerary: { userId } } },
    select: { id: true, date: true, destination: { select: { name: true, country: true, itineraryId: true } } } })
  return { refs, items }
}

// After places leave: empty stops go, and a plan the email itself started goes too once nothing is left in it.
async function tidy(planIds: string[], startedPlan: string, userId: string) {
  for (const id of new Set(planIds)) {
    await prisma.destination.deleteMany({ where: { itineraryId: id, itinerary: { userId }, items: { none: {} }, NOT: { name: 'Destination to decide' } } })
    if (id === startedPlan && !(await prisma.destItem.count({ where: { destination: { itineraryId: id } } }))) await prisma.itinerary.deleteMany({ where: { id, userId, visibility: 'draft' } })
    for (const path of [`/plan/${id}`, `/itinerary/${id}`]) revalidatePath(path)
  }
  revalidatePath('/trips')
}

export async function moveEmailPlaces(ref: string, target: string): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (!validRef(ref)) return { error: 'This link doesn’t work.' }
  const { refs, items } = await emailPlaces(ref, userId)
  if (!items.length) return { error: 'These places are no longer in your trips.' }
  let planId = target
  // A trip of their own: named after where they are.
  if (target === 'new') {
    const form = new FormData()
    for (const [key, value] of Object.entries({ clientId: randomUUID(), title: `Trip to ${items[0].destination.name}`, destination: '', audience: 'family', format: 'auto', startDate: '', endDate: '' })) form.set(key, value)
    const started = await startPlan(form)
    if (!started.id) return { error: started.error ?? 'Couldn’t start the trip. Please try again.' }
    planId = started.id
  }
  const plan = await prisma.itinerary.findFirst({ where: { id: planId, userId, isPlan: true, visibility: 'draft' }, select: { id: true, datesFlexible: true, startDate: true, durationDays: true } })
  if (!plan) return { error: 'Choose one of your private plans.' }
  const from = items.map(item => item.destination.itineraryId)
  await prisma.$transaction(async tx => {
    for (const item of items) {
      if (item.destination.itineraryId === plan.id) continue
      let stop = await tx.destination.findFirst({ where: { itineraryId: plan.id, name: { equals: item.destination.name, mode: 'insensitive' } } })
      if (!stop) stop = await tx.destination.create({ data: { itineraryId: plan.id, name: item.destination.name, country: item.destination.country, order: await tx.destination.count({ where: { itineraryId: plan.id } }) } })
      const last = await tx.destItem.aggregate({ where: { destinationId: stop.id }, _max: { order: true } })
      // Its day in the new trip, from its booking date when that trip has dates.
      const day = !plan.datesFlexible && item.date ? daysBetween(plan.startDate.toISOString().slice(0, 10), item.date.toISOString().slice(0, 10)) + 1 : null
      await tx.destItem.update({ where: { id: item.id }, data: { destinationId: stop.id, order: (last._max.order ?? -1) + 1, dayIndex: day && day >= 1 && day <= Math.max(plan.durationDays ?? 0, 365) ? day : null } })
    }
  }, { timeout: 30000 })
  await tidy(from, refs.plan, userId)
  return { planId: plan.id }
}

export async function undoEmailPlaces(ref: string): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (!validRef(ref)) return { error: 'This link doesn’t work.' }
  const { refs, items } = await emailPlaces(ref, userId)
  if (!items.length) return { error: 'These places are no longer in your trips.' }
  await prisma.destItem.deleteMany({ where: { id: { in: items.map(item => item.id) }, destination: { itinerary: { userId } } } })
  await tidy(items.map(item => item.destination.itineraryId), refs.plan, userId)
  return {}
}
