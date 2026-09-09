'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { pushConfigured } from '@/lib/push'
import { notificationPath } from '@/lib/notificationText'

export async function notificationStatus() {
  const session = await auth()
  if (!session?.user?.id) return { unread: 0, pushReady: false }
  const unread = await prisma.notification.count({ where: { recipientId: session.user.id, readAt: null, itinerary: { visibility: { not: 'draft' } } } })
  return { unread, pushReady: pushConfigured() }
}

export async function registerPushDevice(token: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Please sign in first.' }
  if (!pushConfigured()) return { error: 'iPhone notifications are not available yet.' }
  if (!/^[a-f0-9]{64,200}$/i.test(token)) return { error: 'Invalid device registration.' }
  const device = await prisma.pushDevice.upsert({
    where: { token: token.toLowerCase() }, create: { userId: session.user.id, token: token.toLowerCase() }, update: { userId: session.user.id },
  })
  const jar = await cookies()
  const oldId = jar.get('wayfarer-push-device')?.value
  if (oldId && oldId !== device.id) await prisma.pushDevice.deleteMany({ where: { id: oldId, userId: session.user.id } })
  jar.set('wayfarer-push-device', device.id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 })
  return { success: true }
}

export async function unregisterPushDevice() {
  const session = await auth()
  const jar = await cookies()
  const id = jar.get('wayfarer-push-device')?.value
  if (session?.user?.id && id) await prisma.pushDevice.deleteMany({ where: { id, userId: session.user.id } })
  jar.delete('wayfarer-push-device')
}

export async function markAllNotificationsRead() {
  const session = await auth()
  if (!session?.user?.id) return
  await prisma.notification.updateMany({ where: { recipientId: session.user.id, readAt: null }, data: { readAt: new Date() } })
  revalidatePath('/notifications')
}

export async function openNotification(form: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const id = form.get('id')
  if (typeof id !== 'string') return
  const notification = await prisma.notification.findFirst({ where: { id, recipientId: session.user.id, itinerary: { visibility: { not: 'draft' } } } })
  if (!notification) return
  await prisma.notification.updateMany({ where: { id, recipientId: session.user.id }, data: { readAt: new Date() } })
  redirect(notificationPath(notification.itineraryId, notification.kind))
}
