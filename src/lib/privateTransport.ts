// Private transport: the trip owner can keep every flight, train and transfer to themselves. The places stay in
// their plan, marked with this hidden tag, and are left out wherever anyone else sees the trip (its page, single
// place pages, the AI's view of friends' trips, copies, and browsing friends' places).
export const PRIVATE_TAG = '__private'

export const isPrivateTransport = (item: { type: string; tags?: string[] | null }) => item.type === 'transport' && !!item.tags?.includes(PRIVATE_TAG)
export const withoutPrivateTransport = <T extends { type: string; tags?: string[] | null }>(items: T[]) => items.filter(item => !isPrivateTransport(item))
