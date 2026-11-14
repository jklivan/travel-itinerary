import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { cleanUpPhotos } from '@/lib/photoCleanup'

export const maxDuration = 300

// Daily (vercel.json): erases stored photos nothing uses any more (lib/photoCleanup). Vercel's scheduler signs in
// with CRON_SECRET; it only erases once PHOTO_CLEANUP_ERASE=1 is set, and otherwise just reports. The admin can
// open it in the browser to see the same report without erasing anything.
export async function GET(req: NextRequest) {
  const cron = !!process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
  if (!cron) {
    const session = await auth()
    if (!process.env.ADMIN_EMAIL || session?.user?.email !== process.env.ADMIN_EMAIL) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const report = await cleanUpPhotos({ erase: cron && process.env.PHOTO_CLEANUP_ERASE === '1' })
  console.log('[photo-cleanup]', JSON.stringify({ ...report, examples: undefined }))
  return Response.json(report)
}
