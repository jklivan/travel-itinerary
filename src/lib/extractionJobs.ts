import { get, put } from '@vercel/blob'

// Reading an itinerary takes up to a minute or two. On a phone, switching to another app freezes Postcard and drops
// the request's answer, though the server keeps reading. So each reading is saved under an id the phone chose (private
// Blob, one small file per reading, kept per person), and the phone fetches it when it comes back.
export type ExtractionJob = { status: 'pending' } | { status: 'done'; result: unknown } | { status: 'failed'; error: string }

export const isJobId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(value)
const pathOf = (userId: string, jobId: string) => `extraction-jobs/${userId}/${jobId}.json`

export async function saveExtractionJob(userId: string, jobId: string, job: ExtractionJob) {
  await put(pathOf(userId, jobId), JSON.stringify(job), { access: 'private', contentType: 'application/json', allowOverwrite: true, addRandomSuffix: false })
}

export async function readExtractionJob(userId: string, jobId: string): Promise<ExtractionJob | null> {
  const found = await get(pathOf(userId, jobId), { access: 'private', useCache: false }).catch(() => null)
  if (!found || found.statusCode !== 200 || !found.stream) return null
  try { return JSON.parse(await new Response(found.stream).text()) as ExtractionJob } catch { return null }
}
