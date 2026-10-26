import { auth } from '@/auth'
import { PLANNER_TOOLS } from '@/lib/planner/registry'
import { runPlannerTool } from '@/lib/planner/registry'

// For trying the trip planner's tools one at a time, on previews only (never the live site): POST { name, input }
// as a signed-in user. Tools that change trips stay off here. GET lists the tools.
const allowed = () => process.env.VERCEL_ENV !== 'production'

export async function GET() {
  if (!allowed()) return new Response('Not found', { status: 404 })
  return Response.json(PLANNER_TOOLS.map(tool => ({ name: tool.name, writes: !!tool.writes, required: tool.inputSchema.required ?? [] })))
}

export async function POST(request: Request) {
  if (!allowed()) return new Response('Not found', { status: 404 })
  const userId = (await auth())?.user?.id
  if (!userId) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  const body = await request.json().catch(() => null) as { name?: unknown; input?: unknown } | null
  if (!body || typeof body.name !== 'string') return Response.json({ error: 'Send { name, input }.' }, { status: 400 })
  const result = await runPlannerTool(body.name, body.input, { userId, origin: new URL(request.url).origin })
  return Response.json(result)
}
