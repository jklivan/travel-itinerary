import { AsyncLocalStorage } from 'node:async_hooks'

// The connector (/api/mcp) runs some of the app's own actions (import, start a plan) for the person whose key the
// assistant sent. Those actions take the user from here first, then from the signed-in session. Only server code can
// set it: nothing a browser sends can choose who an action runs as.
const acting = new AsyncLocalStorage<string>()

export function actAs<T>(userId: string, run: () => Promise<T>) { return acting.run(userId, run) }
export function actingUserId() { return acting.getStore() }
