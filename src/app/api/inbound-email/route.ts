import { after } from 'next/server'
import { verifyWebhook } from '@/lib/inbox'
import { processInboundEmail } from '@/lib/inboxImport'

// Resend tells Postcard about mail sent to someone's "Send trips to Postcard" address. Only Resend's signed calls are
// accepted; the email is read after answering, since reading attachments can take a while.
export const maxDuration = 300

export async function POST(request: Request) {
  const body = await request.text()
  if (!verifyWebhook(body, request.headers, process.env.RESEND_WEBHOOK_SECRET ?? '')) return new Response('Invalid signature', { status: 401 })
  const event = JSON.parse(body) as { type?: string; data?: { email_id?: string } }
  const emailId = event.data?.email_id
  if (event.type === 'email.received' && typeof emailId === 'string' && /^[\w-]{8,100}$/.test(emailId)) {
    const origin = new URL(request.url).origin
    after(() => processInboundEmail(emailId, origin).catch(error => console.error('[inbox] failed', error instanceof Error ? error.message : error)))
  }
  return new Response(null, { status: 200 })
}
