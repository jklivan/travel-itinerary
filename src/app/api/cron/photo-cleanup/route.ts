import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { cleanUpPhotos, restorePhotos } from '@/lib/photoCleanup'

export const maxDuration = 300

// Daily (vercel.json): erases stored photos nothing uses any more (lib/photoCleanup). Vercel's scheduler signs in
// with CRON_SECRET; it only erases once PHOTO_CLEANUP_ERASE=1 is set, and otherwise just reports. The admin can
// open it in the browser to see the same report without erasing anything; ?erase=<the report's unused count> moves
// those to the trash once (even when over half look unused), and ?restore=<file name or all> puts trashed ones back.
export async function GET(req: NextRequest) {
  const cron = !!process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
  if (!cron) {
    const session = await auth()
    if (!process.env.ADMIN_EMAIL || session?.user?.email !== process.env.ADMIN_EMAIL) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const restore = cron ? null : req.nextUrl.searchParams.get('restore')
    if (restore) return Response.json(await restorePhotos(restore))
    const confirm = cron ? undefined : Number(req.nextUrl.searchParams.get('erase') ?? NaN)
    const report = await cleanUpPhotos({ erase: cron && process.env.PHOTO_CLEANUP_ERASE === '1', confirm })
    console.log('[photo-cleanup]', JSON.stringify({ ...report, examples: undefined }))
    return Response.json(report)
  } catch (error) {
    console.error('[photo-cleanup] failed', error)
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
