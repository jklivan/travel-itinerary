// A query filter on a person (e.g. `user: notBlocked(viewerId)`): leaves out anyone the viewer blocked or who blocked
// the viewer. Signed-out viewers see everything. (No database import, so shared code can use it.)
export function notBlocked(viewerId: string | null | undefined) {
  return viewerId ? { blocking: { none: { blockedId: viewerId } }, blockedBy: { none: { blockerId: viewerId } } } : {}
}
