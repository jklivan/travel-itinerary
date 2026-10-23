'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { CODE_SECONDS, hash, newSecret } from '@/lib/oauth'

// The person's answer on the "Connect … to Postcard?" page (oauth/authorize).
async function checked(form: FormData) {
  const userId = (await auth())?.user?.id
  const clientId = String(form.get('client_id') ?? ''), redirectUri = String(form.get('redirect_uri') ?? ''), state = String(form.get('state') ?? '').slice(0, 500)
  const challenge = String(form.get('code_challenge') ?? '')
  const client = clientId.length <= 50 ? await prisma.oAuthClient.findUnique({ where: { id: clientId }, select: { id: true, redirectUris: true } }) : null
  // Only ever send people back to an address the assistant registered.
  if (!client || !client.redirectUris.includes(redirectUri)) throw new Error('This app is not registered with Postcard.')
  return { userId, client, redirectUri, state, challenge }
}
const back = (redirectUri: string, params: Record<string, string>) => {
  const url = new URL(redirectUri)
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value)
  return url.toString()
}

export async function allowAssistant(form: FormData) {
  const { userId, client, redirectUri, state, challenge } = await checked(form)
  if (!userId) redirect('/login')
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) redirect(back(redirectUri, { error: 'invalid_request', error_description: 'A PKCE code_challenge (S256) is required.', state }))
  const code = newSecret()
  await prisma.oAuthCode.create({ data: { codeHash: hash(code), clientId: client.id, userId, redirectUri, codeChallenge: challenge, expiresAt: new Date(Date.now() + CODE_SECONDS * 1000) } })
  redirect(back(redirectUri, { code, state }))
}

export async function denyAssistant(form: FormData) {
  const { redirectUri, state } = await checked(form)
  redirect(back(redirectUri, { error: 'access_denied', state }))
}

// Settings → Connected assistants → Disconnect: its keys stop working straight away.
export async function disconnectAssistant(clientId: string) {
  const userId = (await auth())?.user?.id
  if (!userId || typeof clientId !== 'string') return { error: 'Please sign in.' }
  await prisma.oAuthToken.updateMany({ where: { userId, clientId, revokedAt: null }, data: { revokedAt: new Date() } })
  revalidatePath('/settings')
  return { success: true }
}
