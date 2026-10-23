import { toFile } from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { pdfText } from '@/lib/pdfText'
import mammoth from 'mammoth'
import { get } from '@vercel/blob'
import { client, EXTRACT_FUNCTION, PDF_JSON_INSTRUCTION, extractPrompt, parseResult, fetchBlob, extractFromText, type ExtractedItinerary } from '@/lib/extractItinerary'

export const maxDuration = 300

async function extractFromPrivatePdf(url: string, filename: string, prompt: string): Promise<ExtractedItinerary> {
  // Private Blob uploads use the same proven route as trip photos. The server,
  // rather than the browser, authenticates the read before sending the PDF on.
  const result = await get(url, { access: 'private' })
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error('Could not read the uploaded PDF.')
  }
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer())
  // The AI takes PDFs up to 50 MB. Bigger ones (usually full of photos) send just their text.
  if (buffer.length > 45 * 1024 * 1024) {
    const text = await pdfText(new Uint8Array(buffer))
    if (text.replace(/Page \d+:|\s/g, '').length < 200) throw new Error('This PDF is too big to read and has no text in it (it may be scanned pages). Try a smaller copy, or paste the itinerary as notes.')
    return extractFromText(text, prompt)
  }
  const file = await client.files.create({
    file: await toFile(buffer, filename, { type: 'application/pdf' }),
    purpose: 'user_data',
  })
  try {
    const response = await client.responses.create({
      model: 'gpt-5.6-terra',
      input: [{
        role: 'user',
        content: [
          { type: 'input_file', file_id: file.id },
          { type: 'input_text', text: `${prompt}\n\n${PDF_JSON_INSTRUCTION}` },
        ],
      }],
      text: {
        format: { type: 'json_object' },
      },
    })
    return JSON.parse(response.output_text) as ExtractedItinerary
  } finally {
    await client.files.delete(file.id).catch(() => undefined)
  }
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

async function extractFromImageBase64(base64: string, contentType: string, prompt: string): Promise<ExtractedItinerary> {
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text?: string; base64?: string; blobUrl?: string; mediaType?: string; filename?: string; planning?: unknown; tripDestinations?: unknown }
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
      return NextResponse.json({ error: 'No content provided.' }, { status: 400 })
    }

    return NextResponse.json(extracted)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[extract-pdf]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
