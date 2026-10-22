import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import { deliverNotification } from '@/lib/push'
import { createPublishedTripNotifications } from '@/lib/notifications'

export function scheduleTripPublishedNotifications(itineraryId: string) {
  after(async () => {
    try {
      // The shared client hides booking details by default, which its type carries; notifications never read them.
      const notifications = await createPublishedTripNotifications(prisma as unknown as Prisma.TransactionClient, itineraryId)
      // Bound the number of simultaneous APNs connections for popular authors.
      for (let offset = 0; offset < notifications.length; offset += 10) {
        await Promise.allSettled(notifications.slice(offset, offset + 10).map(row => deliverNotification(row.id)))
      }
    } catch { console.error('New trip notifications failed') }
  })
}
