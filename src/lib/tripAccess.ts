// Who can change a trip: its creator, or someone who joined it as a group trip (#116). Use inside a Prisma `where`
// on Itinerary: { id, ...canEdit(userId) }, or { itinerary: canEdit(userId) } from a place or destination.
// Deleting the trip, posting it, and inviting or removing people stay with the creator ({ userId }).
export const canEdit = (userId: string) => ({ OR: [{ userId }, { members: { some: { userId, status: 'joined' } } }] })
