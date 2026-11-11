import { auth } from '@/auth'
import { createSession, importPicked, sessionDone } from '@/lib/googlePhotos'
import { addToPhotoPile } from '@/actions/tripPhotoPile'

export const maxDuration = 300

// From Google Photos (components/GooglePhotosButton): { step: 'start' } makes a picking session, { step: 'poll' } says
// whether the person has finished picking, { step: 'import', tripId } copies the picked photos into the trip's photo pile.
export async function POST(request: Request) {
  if (!(await auth())?.user?.id) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  const body = await request.json().catch(() => null) as { step?: string; token?: unknown; session?: unknown; tripId?: unknown } | null
  const token = typeof body?.token === 'string' && body.token.length < 4096 ? body.token : ''
  const session = typeof body?.session === 'string' && body.session.length < 200 ? body.session : ''
  if (!token) return Response.json({ error: 'Google didn’t give access. Try again.' }, { status: 400 })
  try {
    if (body?.step === 'start') return Response.json(await createSession(token))
    if (!session) return Response.json({ error: 'Start again.' }, { status: 400 })
    if (body?.step === 'poll') return Response.json({ done: await sessionDone(token, session) })
    if (body?.step === 'import' && typeof body.tripId === 'string') {
      const { urls, skipped } = await importPicked(token, session)
      if (urls.length) { const kept = await addToPhotoPile(body.tripId, urls); if (kept.error) return Response.json({ error: kept.error }, { status: 400 }) }
      return Response.json({ urls, skipped })
    }
    return Response.json({ error: 'Unknown step.' }, { status: 400 })
  } catch (error) {
    console.error('[google-photos]', error instanceof Error ? error.message : error)
    return Response.json({ error: 'Google Photos didn’t answer. Please try again.' }, { status: 502 })
  }
}
