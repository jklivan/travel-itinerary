import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { inboxRefs } from '@/lib/inbox'
import FixEmailedPlaces from './FixEmailedPlaces'

export const metadata = { title: 'Fix an emailed trip' }

// From the reply to an emailed trip: where its places went, and a way to move them or undo.
export default async function InboxFixPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const userId = (await auth())?.user?.id
  if (!userId) redirect('/login')
  const valid = /^[a-f0-9-]{36}$/.test(ref)
  const items = valid ? await prisma.destItem.findMany({ where: { id: { startsWith: `${inboxRefs(ref).import}:` }, destination: { itinerary: { userId } } },
    select: { id: true, name: true, destination: { select: { itinerary: { select: { id: true, title: true } } } } } }) : []
  const plans = await prisma.itinerary.findMany({ where: { userId, isPlan: true, visibility: 'draft' }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, title: true } })
  const current = items[0]?.destination.itinerary
  return <div className="page-wrap">
    <header className="page-header"><h1 className="page-title">Your emailed trip</h1></header>
    {!items.length ? <div className="panel-dashed p-6 text-sm text-muted">These places are no longer in your trips. They may have been moved or removed already. <Link href="/trips" className="text-link underline">Go to My Trips</Link></div>
      : <FixEmailedPlaces ref_={ref} current={current!} places={items.map(item => item.name)} plans={plans.filter(plan => plan.id !== current?.id)} />}
  </div>
}
