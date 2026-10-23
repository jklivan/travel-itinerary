import { redirect } from 'next/navigation'
import { Check, Plug, X } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { allowAssistant, denyAssistant } from '@/actions/oauth'

export const metadata = { title: 'Connect an assistant' }

// An AI assistant (Muse, ChatGPT, Claude) asking to use the person's Postcard account through the connector.
// Signed out: sign in first, then come back here. Signed in: allow it or not.
export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams
  const param = (key: string) => { const value = raw[key]; return typeof value === 'string' ? value : '' }
  const clientId = param('client_id'), redirectUri = param('redirect_uri'), state = param('state'), challenge = param('code_challenge')
  const client = clientId && clientId.length <= 50 ? await prisma.oAuthClient.findUnique({ where: { id: clientId }, select: { name: true, redirectUris: true } }) : null
  if (!client || !client.redirectUris.includes(redirectUri)) return <Message title="This link doesn’t work" text="The app that sent you here isn’t set up with Postcard. Try connecting again from the app." />
  if (param('response_type') !== 'code' || param('code_challenge_method') !== 'S256' || !challenge) {
    const url = new URL(redirectUri); url.searchParams.set('error', 'invalid_request'); if (state) url.searchParams.set('state', state)
    redirect(url.toString())
  }

  const session = await auth()
  if (!session?.user?.id) {
    const here = `/oauth/authorize?${new URLSearchParams(Object.entries(raw).flatMap(([key, value]) => typeof value === 'string' ? [[key, value]] : [])).toString()}`
    redirect(`/login?next=${encodeURIComponent(here)}`)
  }

  const fields = <>
    <input type="hidden" name="client_id" value={clientId} />
    <input type="hidden" name="redirect_uri" value={redirectUri} />
    <input type="hidden" name="state" value={state} />
    <input type="hidden" name="code_challenge" value={challenge} />
  </>
  return <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
    <div className="w-full max-w-sm">
      <div className="panel space-y-4 p-6">
        <Plug size={28} className="text-link" />
        <h1 className="type-title">Connect {client.name} to Postcard?</h1>
        <p className="text-sm text-muted">{client.name} will be able to:</p>
        <ul className="space-y-2 text-sm text-ink">
          <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-link" />See your trips and plans</li>
          <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-link" />Start private plans and add places to them, like trips you’ve taken</li>
        </ul>
        <p className="flex gap-2 text-sm text-muted"><X size={16} className="mt-0.5 shrink-0" />It can’t post, delete anything or message anyone. Disconnect it any time in Settings.</p>
        <p className="text-xs text-muted">Signed in as {session.user.email}</p>
        <div className="flex gap-2">
          <form action={allowAssistant} className="flex-1">{fields}<button type="submit" className="btn btn-primary w-full">Allow</button></form>
          <form action={denyAssistant} className="flex-1">{fields}<button type="submit" className="btn btn-outline w-full">Cancel</button></form>
        </div>
      </div>
    </div>
  </div>
}

function Message({ title, text }: { title: string; text: string }) {
  return <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4"><div className="panel w-full max-w-sm p-6"><h1 className="type-title">{title}</h1><p className="mt-2 text-sm text-muted">{text}</p></div></div>
}
