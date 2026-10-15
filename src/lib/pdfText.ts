// The text of a PDF, page by page. Used for PDFs too big to send whole to the AI (photos make most of the size).
export async function pdfText(data: Uint8Array) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await getDocument({ data, useSystemFonts: false }).promise
  const pages: string[] = []
  for (let number = 1; number <= pdf.numPages; number++) {
    const content = await (await pdf.getPage(number)).getTextContent()
    pages.push(`Page ${number}:\n${content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('')}`)
  }
  await pdf.cleanup()
  return pages.join('\n\n')
}
