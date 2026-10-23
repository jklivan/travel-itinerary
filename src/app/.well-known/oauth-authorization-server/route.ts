import { CORS, authorizationServerMetadata, json, originOf } from '@/lib/oauth'

// How assistants sign in to Postcard (see lib/oauth).
export function GET(request: Request) { return json(authorizationServerMetadata(originOf(request))) }
export function OPTIONS() { return new Response(null, { status: 204, headers: CORS }) }
