'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { identifyVisitor } from '@/lib/analytics'

// Links usage analytics to the signed-in account (lib/analytics), and forgets it on sign-out.
export default function AnalyticsIdentify() {
  const { data: session, status } = useSession()
  const id = session?.user?.id
  const name = session?.user?.name
  useEffect(() => {
    if (status === 'loading') return
    identifyVisitor(id ? { id, name } : null)
  }, [status, id, name])
  return null
}
