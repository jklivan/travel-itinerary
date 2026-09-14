import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { geocodePlaceByName } from '@/lib/geocode'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Sign in required' }, { status: 401 })
  const query = req.nextUrl.searchParams.get('q')?.trim()
  if (!query || query.length > 500) return Response.json(null, { status: 400 })
  return Response.json(await geocodePlaceByName(query))
}
