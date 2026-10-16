import { hiddenAccountsFor } from './hiddenAccounts'

// A query filter on a person (e.g. `user: notBlocked(viewerId)`): leaves out anyone the viewer blocked or who blocked
// the viewer, and test accounts (lib/hiddenAccounts). (No database import, so shared code can use it.)
export function notBlocked(viewerId: string | null | undefined) {
  const hidden = { id: { notIn: hiddenAccountsFor(viewerId) } }
  return viewerId ? { blocking: { none: { blockedId: viewerId } }, blockedBy: { none: { blockerId: viewerId } }, ...hidden } : hidden
}
