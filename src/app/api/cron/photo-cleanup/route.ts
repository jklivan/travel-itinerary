import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { cleanUpPhotos } from '@/lib/photoCleanup'

export const maxDuration = 300

// Daily (vercel.json): deletes stored photos nothing uses any more that a remove didn't already catch (uploads never
// saved, a week on; lib/photoCleanup). Vercel's scheduler signs in with CRON_SECRET. The admin can open it in the
// browser for the same report without deleting anything, and ?erase=<the report's unused count> deletes those once
// (the first clean-up, when more than half look unused and the job won't on its own).
export async function GET(req: NextRequest) {
  const cron = !!process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
  if (!cron) {
    const session = await auth()
    if (!process.env.ADMIN_EMAIL || session?.user?.email !== process.env.ADMIN_EMAIL) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const confirm = cron ? undefined : Number(req.nextUrl.searchParams.get('erase') ?? NaN)
    const report = await cleanUpPhotos({ erase: cron, confirm })
    console.log('[photo-cleanup]', JSON.stringify({ ...report, examples: undefined }))
    return Response.json(report)
  } catch (error) {
    console.error('[photo-cleanup] failed', error)
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
