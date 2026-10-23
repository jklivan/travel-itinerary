import { prisma } from '@/lib/prisma'
import { CORS, hash, issueTokens, json, oauthError, pkceMatches } from '@/lib/oauth'

// Swaps a one-time sign-in code for keys, or a refresh key for new keys. Refresh keys are single use: each refresh
// replaces the pair, so a stolen old key stops working.
export async function POST(request: Request) {
  const type = request.headers.get('content-type') ?? ''
  const fields: Record<string, string> = type.includes('application/json')
    ? Object.fromEntries(Object.entries(await request.json().catch(() => ({})) as Record<string, unknown>).map(([key, value]) => [key, String(value)]))
    : Object.fromEntries([...new URLSearchParams(await request.text())])
  const clientId = fields.client_id ?? ''

  if (fields.grant_type === 'authorization_code') {
    const code = fields.code ?? ''
    if (!code) return oauthError('invalid_request', 'Missing code.')
    // Each code works once, even if two requests race.
    const grant = await prisma.oAuthCode.findUnique({ where: { codeHash: hash(code) } })
    if (!grant || !(await prisma.oAuthCode.deleteMany({ where: { id: grant.id } })).count) return oauthError('invalid_grant', 'This sign-in code is unknown or already used.')
    if (grant.expiresAt.getTime() <= Date.now()) return oauthError('invalid_grant', 'This sign-in code has expired. Please connect again.')
    if (clientId && clientId !== grant.clientId) return oauthError('invalid_grant', 'This code was issued to a different app.')
    if ((fields.redirect_uri ?? grant.redirectUri) !== grant.redirectUri) return oauthError('invalid_grant', 'The redirect_uri does not match.')
    if (!pkceMatches(fields.code_verifier ?? '', grant.codeChallenge)) return oauthError('invalid_grant', 'The code_verifier does not match.')
    return json(await issueTokens(grant.clientId, grant.userId))
  }

  if (fields.grant_type === 'refresh_token') {
    const token = await prisma.oAuthToken.findUnique({ where: { tokenHash: hash(fields.refresh_token ?? '') } })
    if (!token || token.kind !== 'refresh' || token.revokedAt || token.expiresAt.getTime() <= Date.now() || (clientId && clientId !== token.clientId)) return oauthError('invalid_grant', 'This key has expired or the app was disconnected. Please connect again.')
    if (!(await prisma.oAuthToken.updateMany({ where: { id: token.id, revokedAt: null }, data: { revokedAt: new Date() } })).count) return oauthError('invalid_grant', 'This key was already used.')
    return json(await issueTokens(token.clientId, token.userId))
  }

  return oauthError('unsupported_grant_type', 'Use authorization_code or refresh_token.')
}

export function OPTIONS() { return new Response(null, { status: 204, headers: CORS }) }
