import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import PeopleList from '@/components/PeopleList'

// Someone's followers, or who they follow (tap the counts on a profile). Each person has a Follow chip.
export default async function PeoplePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params
  const tab = (await searchParams).tab === 'following' ? 'following' : 'followers'
  const viewerId = (await auth())?.user?.id ?? null
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!user) notFound()

  const person = { select: { id: true, name: true, image: true } }
  const [followers, following] = await Promise.all([
    prisma.follow.findMany({ where: { followingId: id, status: 'accepted' }, orderBy: { createdAt: 'desc' }, select: { follower: person } }),
    prisma.follow.findMany({ where: { followerId: id, status: 'accepted' }, orderBy: { createdAt: 'desc' }, select: { following: person } }),
  ])
  const shown = tab === 'followers' ? followers.map(f => f.follower) : following.map(f => f.following)
  // For the viewer's chips: who they follow, and who follows them (for "Follow back").
  const ids = shown.map(p => p.id)
  const [viewerFollows, followsViewer] = viewerId && ids.length ? await Promise.all([
    prisma.follow.findMany({ where: { followerId: viewerId, followingId: { in: ids }, status: 'accepted' }, select: { followingId: true } }),
    prisma.follow.findMany({ where: { followingId: viewerId, followerId: { in: ids }, status: 'accepted' }, select: { followerId: true } }),
  ]) : [[], []]
  const viewerFollowsIds = new Set(viewerFollows.map(f => f.followingId)), followsViewerIds = new Set(followsViewer.map(f => f.followerId))
  const people = shown.map(p => ({ ...p, following: viewerFollowsIds.has(p.id), followsYou: followsViewerIds.has(p.id) }))
  const isOwn = viewerId === id

  return <div className="page-wrap">
    <header className="page-header">
      <h1 className="page-title">{isOwn ? 'Your people' : user.name}</h1>
    </header>
    <nav aria-label="Followers and following" className="tabs mb-5">
      <Link href={`/user/${id}/people`} aria-current={tab === 'followers' ? 'page' : undefined} className="tab">{followers.length} {followers.length === 1 ? 'follower' : 'followers'}</Link>
      <Link href={`/user/${id}/people?tab=following`} aria-current={tab === 'following' ? 'page' : undefined} className="tab">{following.length} following</Link>
    </nav>
    {people.length
      ? <PeopleList key={tab} people={people} viewerId={viewerId} />
      : <p className="panel-dashed p-6 text-center text-sm text-muted">{tab === 'followers' ? (isOwn ? 'No followers yet.' : `No one follows ${user.name} yet.`) : (isOwn ? 'You’re not following anyone yet.' : `${user.name} isn’t following anyone yet.`)}</p>}
  </div>
}
