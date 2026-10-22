'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { notificationStatus, registerPushDevice, unregisterPushDevice, openNotification, sendTestPush } from '@/actions/notifications'

// canAsk: iOS hasn't asked this iPhone about notifications yet (its one-time prompt is still unused).
type PushState = { native: boolean; available: boolean; ready: boolean; enabled: boolean; busy: boolean; message: string; canAsk: boolean; toggle: () => Promise<void> }
const PushContext = createContext<PushState | null>(null)

export default function NativeNotifications({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [native, setNative] = useState(false)
  const [available, setAvailable] = useState(false)
  const [ready, setReady] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [canAsk, setCanAsk] = useState(false)
  const registrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    const listeners: PluginListenerHandle[] = []
    async function setup() {
      const isIOS = Capacitor.getPlatform() === 'ios'
      const hasPlugin = isIOS && Capacitor.isPluginAvailable('PushNotifications')
      setNative(isIOS)
      setAvailable(hasPlugin)
      setEnabled(false)
      setReady(false)
      if (!hasPlugin || !userId) return
      const add = async (listener: Promise<PluginListenerHandle>) => {
        const handle = await listener
        if (active) listeners.push(handle)
        else await handle.remove()
      }
      await add(PushNotifications.addListener('registration', async token => {
        if (!active) return
        if (registrationTimer.current) clearTimeout(registrationTimer.current)
        try {
          const result = await registerPushDevice(token.value)
          if (!active) return
          if (result.error) setMessage(result.error)
          else { setEnabled(true); setMessage('Notifications are on for this iPhone.'); localStorage.removeItem(`push-disabled:${userId}`) }
        } catch { if (active) setMessage('Could not enable notifications. Please try again.') }
        finally { if (active) setBusy(false) }
      }))
      await add(PushNotifications.addListener('registrationError', () => {
        if (!active) return
        if (registrationTimer.current) clearTimeout(registrationTimer.current)
        setBusy(false)
        setMessage('Could not register this iPhone. Please try again.')
      }))
      await add(PushNotifications.addListener('pushNotificationReceived', () => {
        window.dispatchEvent(new Event('notifications-updated'))
      }))
      await add(PushNotifications.addListener('pushNotificationActionPerformed', async event => {
        const id = event.notification.data?.notificationId
        if (!active || typeof id !== 'string') return
        const form = new FormData()
        form.set('id', id)
        await openNotification(form)
      }))
      const status = await notificationStatus()
      if (!active) return
      setReady(status.pushReady)
      const permission = await PushNotifications.checkPermissions()
      if (active) setCanAsk(permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale')
      if (active && status.pushReady && permission.receive === 'granted' && localStorage.getItem(`push-disabled:${userId}`) !== 'true') await PushNotifications.register()
    }
    void setup().catch(() => { if (active) setMessage('Could not check iPhone notifications. Please try again.') })
    return () => {
      active = false
      if (registrationTimer.current) clearTimeout(registrationTimer.current)
      for (const listener of listeners) void listener.remove()
    }
  }, [userId])

  async function toggle() {
    if (!userId || busy) return
    setBusy(true)
    setMessage('')
    try {
      if (enabled) {
        await unregisterPushDevice()
        localStorage.setItem(`push-disabled:${userId}`, 'true')
        await PushNotifications.unregister()
        setEnabled(false)
        setMessage('Notifications are off for this iPhone. Your activity still appears here.')
        setBusy(false)
        return
      }
      const permission = await PushNotifications.requestPermissions()
      setCanAsk(false)
      if (permission.receive !== 'granted') {
        setMessage('To allow alerts, turn on notifications for Postcard in iPhone Settings.')
        setBusy(false)
        return
      }
      registrationTimer.current = setTimeout(() => { setBusy(false); setMessage('Registration timed out. Please try again.') }, 15000)
      await PushNotifications.register()
    } catch {
      if (registrationTimer.current) clearTimeout(registrationTimer.current)
      setMessage('Could not update notifications. Please try again.')
      setBusy(false)
    }
  }

  return <PushContext.Provider value={{ native, available, ready, enabled, busy, message, canAsk, toggle }}>{children}<NotificationPrompt /></PushContext.Provider>
}

// After signing up (or any time iOS hasn't asked yet), in the iPhone app: a short card asking to turn notifications on.
// Turn on shows Apple's prompt; Not now waits a few days, because Apple's prompt can only be shown once.
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000
function NotificationPrompt() {
  const push = useContext(PushContext)
  const { data: session } = useSession()
  const pathname = usePathname()
  const userId = session?.user?.id
  const [show, setShow] = useState(false)
  const wanted = !!push && push.available && push.ready && push.canAsk && !push.enabled && !!userId && !['/login', '/register'].includes(pathname)
  useEffect(() => {
    if (!wanted) return
    const snoozed = Number(localStorage.getItem(`push-prompt-snoozed:${userId}`) ?? 0)
    if (Date.now() - snoozed < SNOOZE_MS) return
    // A moment after the page settles, so it doesn't land on top of the welcome.
    const timer = setTimeout(() => setShow(true), 2500)
    return () => clearTimeout(timer)
  }, [wanted, userId])
  if (!show || !wanted || !push) return null
  const dismiss = () => { localStorage.setItem(`push-prompt-snoozed:${userId}`, String(Date.now())); setShow(false) }
  return <div role="dialog" aria-modal="false" aria-labelledby="push-prompt-title" className="fixed inset-x-3 bottom-[calc(var(--app-bottom-clearance)+0.5rem)] z-[80] mx-auto max-w-md">
    <div className="panel flex gap-3 p-4 shadow-xl">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-link/10 text-link"><Bell size={18} /></span>
      <div className="min-w-0 flex-1">
        <h2 id="push-prompt-title" className="text-sm font-semibold normal-case text-ink">Turn on notifications?</h2>
        <p className="mt-0.5 text-sm text-muted">Hear when friends post a trip, message you or reply to you.</p>
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={push.busy} onClick={async () => { setShow(false); await push.toggle() }} className="btn btn-primary btn-sm">Turn on</button>
          <button type="button" onClick={dismiss} className="btn btn-outline btn-sm">Not now</button>
        </div>
      </div>
    </div>
  </div>
}

export function NotificationPreferences() {
  const push = useContext(PushContext)
  if (!push) return null
  return <section className="panel mb-5 p-4">
    <h2 className="type-label text-ink">iPhone notifications</h2>
    <p className="mt-1 text-sm text-muted">Get an alert for forum posts, private messages, new trips from people you follow, and activity on your trips.</p>
    {!push.native ? <p className="mt-2 text-sm text-muted">Open the iPhone app to enable push notifications.</p> :
      !push.available ? <p className="mt-2 text-sm text-muted">Update the iPhone app to enable notifications.</p> :
        !push.ready ? <p className="mt-2 text-sm text-muted">Push notifications are not available yet. You can still check your activity here.</p> :
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={push.toggle} disabled={push.busy} className="btn btn-primary btn-sm">{push.busy ? 'Updating…' : push.enabled ? 'Turn off on this iPhone' : 'Enable notifications'}</button>
            {push.enabled && <TestPushButton />}
          </div>}
    {push.message && <p role="status" className="mt-2 text-sm text-muted">{push.message}</p>}
  </section>
}

// Sends a notification to this account's iPhones right away and shows Apple's answer, to check the setup.
function TestPushButton() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  return <>
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true); setResult('')
      try {
        const response = await sendTestPush()
        setResult('error' in response && response.error ? response.error : 'results' in response ? `Sent to ${response.ok} of ${response.devices} iPhone${response.devices === 1 ? '' : 's'} (${response.environment}): ${response.results?.join(', ')}. ${response.ok ? 'It should arrive in a few seconds; close the app to see it as a banner.' : ''}` : '')
      } catch { setResult('Could not send a test. Please try again.') } finally { setBusy(false) }
    }} className="btn btn-outline btn-sm">{busy ? 'Sending…' : 'Send a test notification'}</button>
    {result && <p role="status" className="basis-full text-sm text-muted">{result}</p>}
  </>
}
