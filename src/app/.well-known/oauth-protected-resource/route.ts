import { CORS, json, originOf, protectedResourceMetadata } from '@/lib/oauth'

// The connector (/api/mcp) and where to sign in for it.
export function GET(request: Request) { return json(protectedResourceMetadata(originOf(request))) }
export function OPTIONS() { return new Response(null, { status: 204, headers: CORS }) }
