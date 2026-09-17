'use client'

import { useRouter } from 'next/navigation'
import { previousPage } from '@/lib/backNavigation'

export default function BackButton({ fallback, className, children = '← Back' }: {
  fallback: string; className?: string; children?: React.ReactNode
}) {
  const router = useRouter()
  return <button type="button" className={className} onClick={() => {
    if (previousPage(window.history.state)) router.back()
    else router.push(fallback)
  }}>{children}</button>
}
