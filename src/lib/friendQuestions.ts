// The author chooses the audience by following them, not the other way around.
export function questionAudience(userId: string) {
  return { OR: [
    { authorId: userId },
    { author: { following: { some: { followingId: userId, status: 'accepted' } } } },
  ] }
}
