import type { Prisma } from '@/generated/prisma/client'

export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000
export type StoryCard = {
  id: string; authorId: string; authorName: string; placeName: string; destination: string;
  type: string; photoUrl: string; caption: string; createdAt: string; expiresAt: string; tripHref: string | null
}
export function visibleStoriesWhere(userId: string | null, following = false, now = new Date()): Prisma.StoryWhereInput {
  const followed = userId ? { user: { followers: { some: { followerId: userId, status: 'accepted' } } } } : null
  return {
    expiresAt: { gt: now },
    OR: [
      ...(!following ? [{ user: { isPrivate: false } }] : []),
      ...(userId ? [{ userId }] : []),
      ...(followed ? [followed] : []),
    ],
  }
}
export function groupStories(stories: StoryCard[], userId: string | null) {
  const groups = new Map<string, StoryCard[]>()
  for (const story of stories) groups.set(story.authorId, [...(groups.get(story.authorId) ?? []), story])
  return [...groups.entries()].map(([authorId, items]) => ({ authorId, items: items.sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }))
    .sort((a, b) => a.authorId === userId ? -1 : b.authorId === userId ? 1 : b.items.at(-1)!.createdAt.localeCompare(a.items.at(-1)!.createdAt))
}
