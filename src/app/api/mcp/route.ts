import { CORS, json, originOf, resourceMetadataUrl, userFromBearer } from '@/lib/oauth'
import { TOOLS, callTool } from '@/lib/mcpTools'

// Postcard's connector for AI assistants (Muse, ChatGPT and Dots, Claude): the Model Context Protocol over HTTP,
// answered as plain JSON. Every request needs the key the person gave the assistant by allowing it; without one,
// the assistant is pointed to Postcard's sign-in (see lib/oauth).
export const maxDuration = 300

const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26']
type Message = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }

const result = (id: Message['id'], value: unknown) => ({ jsonrpc: '2.0', id, result: value })
const failure = (id: Message['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

async function answer(message: Message, userId: string, origin: string) {
  const { id, method, params = {} } = message
  if (message.jsonrpc !== '2.0' || typeof method !== 'string') return failure(id, -32600, 'Invalid request')
  // Notifications ("initialized", "cancelled") need no answer.
  if (id === undefined || id === null) return null
  if (method === 'initialize') {
    const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : ''
    return result(id, {
      protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'postcard', title: 'Postcard', version: '1.0.0' },
      instructions: 'Postcard is where friends share the places worth going, and plan trips. Use list_trips and get_trip to see the person’s trips; import_trip to turn a written summary of a trip (past or planned) into a private plan, one call per trip; add_places to add places to a private plan. Plans stay private until the person posts them in the app.',
    })
  }
  if (method === 'ping') return result(id, {})
  if (method === 'tools/list') return result(id, { tools: TOOLS })
  if (method === 'tools/call') {
    const name = typeof params.name === 'string' ? params.name : ''
    if (!TOOLS.some(tool => tool.name === name)) return failure(id, -32602, `Unknown tool: ${name}`)
    try {
      const output = await callTool(name, params.arguments && typeof params.arguments === 'object' ? params.arguments as Record<string, unknown> : {}, userId, origin)
      return result(id, { content: [{ type: 'text', text: output.text }], isError: !!output.error })
    } catch (error) {
      console.error('[mcp]', name, error instanceof Error ? error.message : error)
      return result(id, { content: [{ type: 'text', text: 'Postcard couldn’t do that just now. Please try again.' }], isError: true })
    }
  }
  return failure(id, -32601, `Method not found: ${method}`)
}

export async function POST(request: Request) {
  const origin = originOf(request)
  const userId = await userFromBearer(request)
  if (!userId) return json({ error: 'invalid_token', error_description: 'Connect Postcard to sign in.' }, 401, { 'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl(origin)}"` })
  const body = await request.json().catch(() => undefined) as Message | Message[] | undefined
  if (!body || typeof body !== 'object') return json(failure(null, -32700, 'Parse error'), 400)
  if (Array.isArray(body)) {
    const answers = (await Promise.all(body.map(message => answer(message, userId, origin)))).filter(Boolean)
    return answers.length ? json(answers) : new Response(null, { status: 202, headers: CORS })
  }
  const reply = await answer(body, userId, origin)
  return reply ? json(reply) : new Response(null, { status: 202, headers: CORS })
}

// No server-sent stream: everything is answered in the POST.
export function GET() { return new Response('Method Not Allowed', { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } }) }
export function DELETE() { return new Response(null, { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } }) }
export function OPTIONS() { return new Response(null, { status: 204, headers: CORS }) }
