import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deliverNotification } from '@/lib/push'
import { createPublishedTripNotifications } from '@/lib/notifications'

export function scheduleTripPublishedNotifications(itineraryId: string) {
  after(async () => {
    try {
      const notifications = await createPublishedTripNotifications(prisma, itineraryId)
      // Bound the number of simultaneous APNs connections for popular authors.
      for (let offset = 0; offset < notifications.length; offset += 10) {
        await Promise.allSettled(notifications.slice(offset, offset + 10).map(row => deliverNotification(row.id)))
      }
    } catch { console.error('New trip notifications failed') }
  })
}
