'use client'

import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import useNotificationCounts from './useNotificationCounts'

// Messages moved from the bottom bar to the header, next to notifications.
export default function HeaderMessagesLink() {
  const { unreadMessages } = useNotificationCounts()
  return <Link href="/messages" aria-label={`Messages${unreadMessages ? `, ${unreadMessages} unread` : ''}`} className="relative rounded-full p-2 hover:bg-white/10">
    <MessageCircle size={20} />
    {unreadMessages > 0 && <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-[#59694f] px-1 text-center text-[10px] text-white">{unreadMessages > 99 ? '99+' : unreadMessages}</span>}
  </Link>
}
