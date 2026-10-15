import { extractText } from 'unpdf'

// The text of a PDF, page by page. Used for PDFs too big to send whole to the AI (photos make most of the size).
// unpdf is PDF.js built for servers (plain pdfjs-dist needs browser drawing APIs that Vercel functions don't have).
export async function pdfText(data: Uint8Array) {
  const { text } = await extractText(data)
  return text.map((page, index) => `Page ${index + 1}:\n${page}`).join('\n\n')
}
