import { NextRequest, NextResponse, after } from 'next/server'
import { auth } from '@/auth'
import { isJobId, readExtractionJob, saveExtractionJob } from '@/lib/extractionJobs'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import { get } from '@vercel/blob'
import { client, EXTRACT_FUNCTION, extractPrompt, parseResult, fetchBlob, extractFromText, extractFromPdfBuffer, extractFromImageBase64, type ExtractedItinerary } from '@/lib/extractItinerary'

export const maxDuration = 300

async function extractFromPrivatePdf(url: string, filename: string, prompt: string): Promise<ExtractedItinerary> {
  // Private Blob uploads use the same proven route as trip photos. The server,
  // rather than the browser, authenticates the read before sending the PDF on.
  const result = await get(url, { access: 'private' })
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error('Could not read the uploaded PDF.')
  }
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer())
  return extractFromPdfBuffer(buffer, filename, prompt)
}

async function extractFromImageUrl(url: string, contentType: string, prompt: string): Promise<ExtractedItinerary> {
  // Fetch Blob ourselves, then send the image bytes to vision. This avoids both
  // OpenAI's remote-URL fetch and its PDF-only file-input restriction.
  const res = await fetchBlob(url)
  const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
  const completion = await client.chat.completions.create({
    model: 'gpt-5.6-terra',
    reasoning_effort: 'none',
    tools: [EXTRACT_FUNCTION],
    tool_choice: { type: 'function', function: { name: 'extract_itinerary' } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64}` } },
        { type: 'text', text: prompt },
      ],
    }],
  })
  return parseResult(completion)
}

type Body = { text?: string; base64?: string; blobUrl?: string; mediaType?: string; filename?: string; planning?: unknown; tripDestinations?: unknown; jobId?: unknown }
class NoContent extends Error {}

async function extract(body: Body): Promise<ExtractedItinerary> {
  const tripDestinations = Array.isArray(body.tripDestinations)
    ? body.tripDestinations.filter((name): name is string => typeof name === 'string' && !!name.trim()).map(name => name.trim().slice(0, 160)).slice(0, 20) : []
  const prompt = extractPrompt(body.planning === true, tripDestinations)

  let extracted: ExtractedItinerary

  if (body.base64 && body.mediaType?.includes('wordprocessingml')) {
    // .docx sent as base64 — no Blob round-trip needed
    const buffer = Buffer.from(body.base64, 'base64')
    const result = await mammoth.extractRawText({ buffer })
    extracted = await extractFromText(result.value, prompt)
  } else if (body.base64 && body.mediaType?.startsWith('image/')) {
    extracted = await extractFromImageBase64(body.base64, body.mediaType, prompt)
  } else if (body.blobUrl && body.mediaType?.startsWith('image/')) {
    extracted = await extractFromImageUrl(body.blobUrl, body.mediaType, prompt)
  } else if (body.blobUrl && body.mediaType?.includes('pdf')) {
    extracted = await extractFromPrivatePdf(body.blobUrl, body.filename ?? 'itinerary.pdf', prompt)
  } else if (body.blobUrl) {
    // XLSX — fetch and parse to CSV text
    const res = await fetchBlob(body.blobUrl)
    const buffer = Buffer.from(await res.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const text = workbook.SheetNames.map(name =>
      `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`
    ).join('\n\n')
    extracted = await extractFromText(text, prompt)
  } else if (body.text?.trim()) {
    extracted = await extractFromText(body.text, prompt)
  } else {
    throw new NoContent('No content provided.')
  }
  return extracted
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    // A reading the phone may come back for (see extractionJobs): saved as it starts and when it ends, and the
    // function stays alive until the result is saved, even if the phone has gone.
    const jobId = isJobId(body.jobId) ? body.jobId : null
    const userId = jobId ? (await auth())?.user?.id ?? null : null
    if (userId && jobId) await saveExtractionJob(userId, jobId, { status: 'pending' }).catch(() => {})
    const work = extract(body)
    if (userId && jobId) after(() => work.then(
      result => saveExtractionJob(userId, jobId, { status: 'done', result }),
      error => saveExtractionJob(userId, jobId, { status: 'failed', error: error instanceof Error ? error.message : 'Could not read this file.' }),
    ).catch(() => console.error('[extract-pdf] could not save the reading')))
    return NextResponse.json(await work)
  } catch (err) {
    if (err instanceof NoContent) return NextResponse.json({ error: err.message }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[extract-pdf]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// The phone coming back for a reading it started: done (with the result), failed, still reading, or unknown (never
// started here, so it should send it again).
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('job')
  const userId = (await auth())?.user?.id
  if (!userId) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  if (!isJobId(jobId)) return NextResponse.json({ error: 'Invalid reading.' }, { status: 400 })
  const job = await readExtractionJob(userId, jobId)
  return NextResponse.json(job ?? { status: 'unknown' }, { headers: { 'Cache-Control': 'no-store' } })
}
