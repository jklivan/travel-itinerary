// Sends an email through Resend. Returns false (and logs why) when it can't.
export async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text: string; html: string }) {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.warn('[email] RESEND_API_KEY is not set'); return false }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? 'Postcard <no-reply@postcardtravel.app>', to, subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) { console.error('[email] Resend error', response.status, (await response.text()).slice(0, 300)); return false }
    return true
  } catch (error) { console.error('[email] send failed', error); return false }
}
