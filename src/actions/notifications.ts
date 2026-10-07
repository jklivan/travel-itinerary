'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { pushConfigured, sendToDevices } from '@/lib/push'
import { notificationPath, forumNotificationWhere, forumReplyNotificationWhere } from '@/lib/notificationText'

export async function notificationStatus() {
  const session = await auth()
  if (!session?.user?.id) return { unread: 0, unreadMessages: 0, unreadAlerts: 0, pushReady: false }
  const [unread, unreadMessages] = await Promise.all([
    prisma.notification.count({ where: { recipientId: session.user.id, readAt: null, OR: [forumReplyNotificationWhere(session.user.id), forumNotificationWhere(session.user.id), { kind: 'message', messageId: { not: null } }, { kind: 'follow' }, { itinerary: { visibility: { not: 'draft' } } }] } }),
    prisma.notification.count({ where: { recipientId: session.user.id, readAt: null, OR: [{ kind: 'message', messageId: { not: null } }, forumReplyNotificationWhere(session.user.id)] } }),
  ])
  // Alerts (shown on Profile, red dot on the profile icon) are everything except messages and replies to your questions.
  return { unread, unreadMessages, unreadAlerts: Math.max(0, unread - unreadMessages), pushReady: pushConfigured() }
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
  revalidatePath('/messages')
  revalidatePath('/profile')
}

export async function openNotification(form: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const id = form.get('id')
  if (typeof id !== 'string') return
  const notification = await prisma.notification.findFirst({ where: { id, recipientId: session.user.id, OR: [forumReplyNotificationWhere(session.user.id), forumNotificationWhere(session.user.id), { kind: 'message', messageId: { not: null } }, { kind: 'follow' }, { itinerary: { visibility: { not: 'draft' } } }] }, include: { message: { select: { itineraryId: true } } } })
  if (!notification) return
  await prisma.notification.updateMany({ where: { id, recipientId: session.user.id }, data: { readAt: new Date() } })
  revalidatePath('/notifications')
  revalidatePath('/messages')
  redirect(notificationPath(notification.kind === 'message' ? notification.message?.itineraryId ?? null : notification.itineraryId, notification.kind, notification.actorId, notification.questionId))
}

// Settings → "Send a test notification": pushes straight to this account's iPhones and reports what Apple said.
export async function sendTestPush() {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Please sign in first.' }
  if (!pushConfigured()) return { error: 'Notifications aren’t set up on the server.' }
  const devices = await prisma.pushDevice.findMany({ where: { userId: session.user.id } })
  if (!devices.length) return { error: 'This account has no iPhone registered. Tap Enable notifications first.' }
  const payload = JSON.stringify({ aps: { alert: { title: 'Postcard', body: 'Test notification: notifications are working.' }, sound: 'default' }, url: '/settings' })
  const results = await sendToDevices(devices, payload, `test-${Date.now()}`)
  console.log('test push', JSON.stringify({ environment: process.env.APNS_ENVIRONMENT || 'production', results }))
  const ok = results.filter(result => result.status === 200).length
  return { devices: devices.length, ok, results: results.map(result => result.status === 200 ? 'Sent' : `${result.status || 'No connection'}${result.reason ? ` ${result.reason}` : ''}`), environment: process.env.APNS_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production' }
}
