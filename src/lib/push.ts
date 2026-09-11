import { createPrivateKey, sign } from 'node:crypto'
import { connect } from 'node:http2'
import { prisma } from '@/lib/prisma'
import { notificationText, notificationPath } from '@/lib/notificationText'

export function pushConfigured() {
  return Boolean(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY && process.env.APNS_BUNDLE_ID)
}

function providerToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: process.env.APNS_KEY_ID })).toString('base64url')
  const claims = Buffer.from(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) })).toString('base64url')
  const input = `${header}.${claims}`
  const signature = sign('sha256', Buffer.from(input), {
    key: createPrivateKey(process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, '\n')),
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url')
  return `${input}.${signature}`
}

export async function deliverNotification(id: string) {
  if (!pushConfigured()) return
  const notification = await prisma.notification.findUnique({
    where: { id }, include: { actor: { select: { name: true } }, itinerary: { select: { title: true, visibility: true } } },
  })
  if (!notification || notification.itinerary.visibility === 'draft') return
  const devices = await prisma.pushDevice.findMany({ where: { userId: notification.recipientId } })
  if (!devices.length) return
  const authorization = `bearer ${providerToken()}`
  const payload = JSON.stringify({
    aps: { alert: { title: 'Xen', body: notificationText(notification.kind, notification.actor.name.slice(0, 80), notification.itinerary.title.slice(0, 200)) }, sound: 'default', 'thread-id': notification.itineraryId },
    url: notificationPath(notification.itineraryId, notification.kind), notificationId: id,
  })
  // TestFlight and App Store builds use production APNs. Sandbox is for local development builds only.
  const host = process.env.APNS_ENVIRONMENT === 'sandbox' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com'
  const results = await Promise.allSettled(devices.map(device => new Promise<void>((resolve, reject) => {
    const client = connect(host)
    const timer = setTimeout(() => { client.destroy(); reject(new Error('APNs timeout')) }, 8000)
    client.on('error', error => { clearTimeout(timer); client.destroy(); reject(error) })
    const request = client.request({ ':method': 'POST', ':path': `/3/device/${device.token}`, authorization,
      'apns-topic': process.env.APNS_BUNDLE_ID!, 'apns-push-type': 'alert', 'apns-priority': '10',
      'apns-collapse-id': id, 'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
    })
    let status = 0
    let response = ''
    request.on('response', headers => { status = Number(headers[':status']) })
    request.setEncoding('utf8')
    request.on('data', chunk => { response += chunk })
    request.on('error', error => { clearTimeout(timer); client.destroy(); reject(error) })
    request.on('end', () => {
      clearTimeout(timer)
      client.close()
      if (status === 410) {
        // Keep a token that was registered again while this request was in flight.
        void prisma.pushDevice.deleteMany({ where: { id: device.id, updatedAt: device.updatedAt } }).then(() => resolve(), reject)
      } else if (status !== 200) {
        console.error('APNs delivery failed', status, response)
        resolve()
      } else resolve()
    })
    request.end(payload)
  })))
  for (const result of results) if (result.status === 'rejected') console.error('APNs connection failed')
}
