import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'

// Sign-in for AI assistants (Muse, ChatGPT, Claude) using Postcard's connector: OAuth 2.1 with PKCE and dynamic
// client registration, as MCP clients expect. Codes and keys are random and stored only as hashes.
export const ACCESS_SECONDS = 60 * 60
export const REFRESH_SECONDS = 90 * 24 * 60 * 60
export const CODE_SECONDS = 5 * 60

export const newSecret = () => randomBytes(32).toString('base64url')
export const hash = (value: string) => createHash('sha256').update(value).digest('hex')
// PKCE: the assistant proves it started this sign-in by sending the secret behind the challenge.
export const pkceMatches = (verifier: string, challenge: string) => /^[A-Za-z0-9._~-]{43,128}$/.test(verifier) && createHash('sha256').update(verifier).digest('base64url') === challenge

// Where an assistant may be sent back to: a secure web address, or the person's own computer while testing.
export function validRedirect(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false
  try {
    const url = new URL(value)
    if (url.hash) return false
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  } catch { return false }
}

// Postcard's own address as the assistant reached it (www.postcardtravel.app, or the preview).
export const originOf = (request: Request) => new URL(request.url).origin
export const resourceMetadataUrl = (origin: string) => `${origin}/.well-known/oauth-protected-resource`

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['trips'],
  }
}

export function protectedResourceMetadata(origin: string) {
  return { resource: `${origin}/api/mcp`, authorization_servers: [origin], scopes_supported: ['trips'], bearer_methods_supported: ['header'], resource_name: 'Postcard' }
}

// Assistants call these from anywhere; keys travel in a header, never cookies, so allowing any origin is safe.
export const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id', 'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id' }
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { ...CORS, 'Cache-Control': 'no-store', ...headers } })
export const oauthError = (error: string, description: string, status = 400) => json({ error, error_description: description }, status)

// A fresh pair of keys for one person and one assistant.
export async function issueTokens(clientId: string, userId: string) {
  const access = newSecret(), refresh = newSecret()
  const now = Date.now()
  await prisma.oAuthToken.createMany({ data: [
    { tokenHash: hash(access), kind: 'access', clientId, userId, expiresAt: new Date(now + ACCESS_SECONDS * 1000) },
    { tokenHash: hash(refresh), kind: 'refresh', clientId, userId, expiresAt: new Date(now + REFRESH_SECONDS * 1000) },
  ] })
  return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_SECONDS, refresh_token: refresh, scope: 'trips' }
}

// The person an assistant's key belongs to, or null (missing, wrong, expired or disconnected).
export async function userFromBearer(request: Request) {
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec(request.headers.get('authorization') ?? '')
  if (!match) return null
  const token = await prisma.oAuthToken.findUnique({ where: { tokenHash: hash(match[1]) }, select: { id: true, kind: true, userId: true, expiresAt: true, revokedAt: true, lastUsedAt: true } })
  if (!token || token.kind !== 'access' || token.revokedAt || token.expiresAt.getTime() <= Date.now()) return null
  // When it was last used, for Settings (at most once every few minutes).
  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > 5 * 60 * 1000) await prisma.oAuthToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
  return token.userId
}
