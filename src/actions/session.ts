'use server'

import { signOut } from '@/auth'
import { unregisterPushDevice } from '@/actions/notifications'

// Settings > Sign out: stop this phone's notifications, then end the session. The page then reloads itself.
export async function signOutNow() {
  await unregisterPushDevice().catch(() => {})
  await signOut({ redirect: false })
}
