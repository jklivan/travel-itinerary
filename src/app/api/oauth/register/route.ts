import { prisma } from '@/lib/prisma'
import { CORS, json, oauthError, validRedirect } from '@/lib/oauth'

// An assistant registers itself once (its name and where to send people back after they allow it), and gets the
// client id it signs people in with. Assistants without a secret only: they prove themselves with PKCE instead.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { client_name?: unknown; redirect_uris?: unknown } | null
  const redirectUris = Array.isArray(body?.redirect_uris) ? body.redirect_uris : []
  if (!redirectUris.length || redirectUris.length > 10 || !redirectUris.every(validRedirect)) return oauthError('invalid_redirect_uri', 'Send one to ten https redirect_uris.')
  const name = typeof body?.client_name === 'string' && body.client_name.trim() ? body.client_name.trim().slice(0, 200) : 'An AI assistant'
  const client = await prisma.oAuthClient.create({ data: { name, redirectUris: redirectUris as string[] } })
  return json({
    client_id: client.id, client_name: client.name, redirect_uris: client.redirectUris, client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
  }, 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: CORS }) }
