import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { handleReport } from '@/actions/safety'

// Admin: open reports (newest first), with what was reported and a link to it, to review within 24 hours.
export default async function AdminReports() {
  const reports = await prisma.report.findMany({ where: { status: 'open' }, orderBy: { createdAt: 'desc' }, take: 100, include: { reporter: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } } } })
  const ids = (kind: string) => reports.filter(report => report.kind === kind).map(report => report.targetId)
  const [comments, messages, stories, trips] = await Promise.all([
    prisma.comment.findMany({ where: { id: { in: ids('comment') } }, select: { id: true, content: true, itineraryId: true } }),
    prisma.directMessage.findMany({ where: { id: { in: ids('message') } }, select: { id: true, content: true } }),
    prisma.story.findMany({ where: { id: { in: ids('snapshot') } }, select: { id: true, caption: true, placeName: true } }),
    prisma.itinerary.findMany({ where: { id: { in: ids('trip') } }, select: { id: true, title: true } }),
  ])
  function what(kind: string, targetId: string) {
    if (kind === 'trip') { const trip = trips.find(t => t.id === targetId); return { text: trip?.title ?? '(deleted trip)', href: trip ? `/itinerary/${trip.id}?as=guest` : null } }
    if (kind === 'comment') { const comment = comments.find(c => c.id === targetId); return { text: comment?.content ?? '(deleted comment)', href: comment ? `/itinerary/${comment.itineraryId}?as=guest#comments` : null } }
    if (kind === 'message') return { text: messages.find(m => m.id === targetId)?.content ?? '(deleted message)', href: null }
    if (kind === 'snapshot') { const story = stories.find(s => s.id === targetId); return { text: story ? `${story.placeName}${story.caption ? `: ${story.caption}` : ''}` : '(expired or deleted snapshot)', href: null } }
    if (kind === 'question') return { text: 'Ask your friends question', href: `/explore/questions/${targetId}` }
    return { text: 'Account', href: `/user/${targetId}` }
  }
  return <section className="panel p-5" aria-labelledby="reports-heading">
    <h2 id="reports-heading" className="type-title">Reports <span className="text-sm text-muted">({reports.length} open)</span></h2>
    <p className="mt-1 text-sm text-muted">Review each within 24 hours. Remove anything that breaks the terms (delete the post, or the account in the database), then mark it handled.</p>
    {reports.length === 0 ? <p className="mt-4 text-sm text-muted">No open reports.</p> : <ul className="mt-4 divide-y divide-line-soft">{reports.map(report => {
      const item = what(report.kind, report.targetId)
      return <li key={report.id} className="space-y-1 py-3 text-sm">
        <p><strong className="uppercase tracking-caps text-danger">{report.kind}</strong> · {report.reason} · {report.createdAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        <p className="break-words">{item.href ? <Link href={item.href} className="text-link underline">{item.text}</Link> : item.text}</p>
        {report.details && <p className="text-muted">“{report.details}”</p>}
        <p className="text-xs text-muted">Reported by <Link href={`/user/${report.reporter.id}`} className="underline">{report.reporter.name}</Link>{report.subject && <> · about <Link href={`/user/${report.subject.id}`} className="underline">{report.subject.name}</Link></>}</p>
        <form action={async () => { 'use server'; await handleReport(report.id) }}><button type="submit" className="btn btn-outline btn-sm mt-1">Mark handled</button></form>
      </li>
    })}</ul>}
  </section>
}
