'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { notificationStatus, registerPushDevice, unregisterPushDevice, openNotification } from '@/actions/notifications'

type PushState = { native: boolean; available: boolean; ready: boolean; enabled: boolean; busy: boolean; message: string; toggle: () => Promise<void> }
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
      if (permission.receive !== 'granted') {
        setMessage('To allow alerts, turn on notifications for Xen in iPhone Settings.')
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

  return <PushContext.Provider value={{ native, available, ready, enabled, busy, message, toggle }}>{children}</PushContext.Provider>
}

export function NotificationPreferences() {
  const push = useContext(PushContext)
  if (!push) return null
  return <section className="mb-5 rounded-xl border border-[#e3dfd2] bg-[#faf7ee] p-4">
    <h2 className="font-semibold text-[#2e4147]">iPhone notifications</h2>
    <p className="mt-1 text-sm text-[#6b7067]">Get an alert when someone comments on or saves your trip.</p>
    {!push.native ? <p className="mt-2 text-sm text-[#6b7067]">Open the iPhone app to enable push notifications.</p> :
      !push.available ? <p className="mt-2 text-sm text-[#6b7067]">Update the iPhone app to enable notifications.</p> :
        !push.ready ? <p className="mt-2 text-sm text-[#6b7067]">Push notifications are not available yet. You can still check your activity here.</p> :
          <button onClick={push.toggle} disabled={push.busy} className="mt-3 rounded-full bg-[#507c76] px-4 py-2 text-sm text-white disabled:opacity-50">{push.busy ? 'Updating…' : push.enabled ? 'Turn off on this iPhone' : 'Enable notifications'}</button>}
    {push.message && <p role="status" className="mt-2 text-sm text-[#6b7067]">{push.message}</p>}
  </section>
}
