import type { Prisma } from '@/generated/prisma/client'

// Moves every place of one destination into another and removes the emptied one.
export async function moveDestinationInto(tx: Prisma.TransactionClient, from: { id: string; days: number | null }, into: { id: string; days: number | null }) {
  // Older plans counted days from 0 in some destinations; put both on the same footing before mixing them.
  for (const destinationId of [from.id, into.id]) {
    const zeroBased = await tx.destItem.count({ where: { destinationId, dayIndex: 0, type: { not: 'hotel' } } })
    if (zeroBased) await tx.destItem.updateMany({ where: { destinationId, dayIndex: { not: null } }, data: { dayIndex: { increment: 1 } } })
  }
  const last = await tx.destItem.aggregate({ where: { destinationId: into.id }, _max: { order: true, groupIndex: true } })
  const items = await tx.destItem.findMany({ where: { destinationId: from.id }, orderBy: { order: 'asc' }, select: { id: true, type: true, groupIndex: true } })
  for (const [index, item] of items.entries()) await tx.destItem.update({ where: { id: item.id }, data: {
    destinationId: into.id, order: (last._max.order ?? -1) + 1 + index,
    ...(item.type === 'hotel' ? { groupIndex: (last._max.groupIndex ?? -1) + 1 + item.groupIndex } : {}),
  } })
  if (from.days || into.days) await tx.destination.update({ where: { id: into.id }, data: { days: (from.days ?? 0) + (into.days ?? 0) } })
  await tx.destination.delete({ where: { id: from.id } })
}
