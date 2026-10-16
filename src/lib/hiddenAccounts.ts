// Accounts used for testing the app: hidden from everyone but themselves (feeds, Explore, people lists, search,
// suggestions, likes, comments, alerts and their profile). No database import, so shared code can use it.
export const TEST_ACCOUNT_IDS = ['cmu7db5vj00000agm1jw9637i']

// The hidden accounts this viewer shouldn't see (all of them, unless they're one).
export const hiddenAccountsFor = (viewerId: string | null | undefined) => TEST_ACCOUNT_IDS.filter(id => id !== viewerId)
