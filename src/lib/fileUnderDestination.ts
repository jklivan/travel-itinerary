import type { Prisma } from '@/generated/prisma/client'
import { destinationsByDistance, planDestinationFor, type CopiedPlace } from '@/lib/planDestinationMatch'

// The person's answer to "Which destination?": one of the plan's destination ids, or 'new' for the place's own town.
export type DestinationChoice = string | undefined
export type DestinationQuestion = { options: { id: string; name: string }[]; newName: string }

const label = (destination: { name: string; country?: string | null }) => [destination.name, destination.country].filter(Boolean).join(', ')

// Where a copied place goes in a plan: the destination it clearly belongs to, the one the person chose, or a new
// destination for its own town ('new'). With no clear match and no choice yet, returns the question to ask instead.
export async function fileUnderDestination(tx: Prisma.TransactionClient, planId: string, place: CopiedPlace, choice: DestinationChoice): Promise<{ id: string } | { ask: DestinationQuestion }> {
  const destinations = await tx.destination.findMany({ where: { itineraryId: planId }, orderBy: { order: 'asc' }, include: { items: { where: { lat: { not: null } }, select: { lat: true, lng: true }, take: 50 } } })
  if (choice && choice !== 'new') {
    const chosen = destinations.find(destination => destination.id === choice)
    if (chosen) return chosen
  }
  const match = planDestinationFor(destinations, place)
  if (match) return match
  const real = destinations.filter(destination => destination.name !== 'Destination to decide')
  // A plan with no destination of its own yet: the placeholder takes the place's town, so nothing needs asking.
  if (!real.length) {
    const placeholder = destinations.find(destination => destination.name === 'Destination to decide')
    if (placeholder && !placeholder.items.length && !await tx.destItem.count({ where: { destinationId: placeholder.id } })) {
      return tx.destination.update({ where: { id: placeholder.id }, data: { name: place.destination.name, country: place.destination.country ?? null } })
    }
  }
  if (choice !== 'new' && real.length) return { ask: { options: destinationsByDistance(real, place).map(destination => ({ id: destination.id, name: label(destination) })), newName: label(place.destination) } }
  return tx.destination.create({ data: { itineraryId: planId, name: place.destination.name, country: place.destination.country ?? null, order: Math.max(-1, ...destinations.map(destination => destination.order)) + 1 } })
}
