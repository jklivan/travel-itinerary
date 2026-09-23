// Browser-side crashes never reach the server logs on their own. The client reports them here
// so they show up in Vercel logs as `[client-error]` lines.
export async function POST(request: Request) {
  const text = await request.text().catch(() => '')
  if (!text || text.length > 16000) return new Response(null, { status: 204 })
  let report: Record<string, unknown>
  try { report = JSON.parse(text) } catch { return new Response(null, { status: 204 }) }
  const field = (key: string, max: number) => typeof report[key] === 'string' ? (report[key] as string).slice(0, max) : undefined
  console.error('[client-error]', JSON.stringify({
    kind: field('kind', 40), message: field('message', 1000), digest: field('digest', 100), url: field('url', 500),
    stack: field('stack', 4000), userAgent: request.headers.get('user-agent')?.slice(0, 300),
  }))
  return new Response(null, { status: 204 })
}
