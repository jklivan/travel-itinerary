'use client'

import Link from 'next/link'
import { ChevronRight, FileText, Mail, Sparkles } from 'lucide-react'

// Tips for new users: three ways to bring trips in (each opens its page, whose Continue goes to `back`), and a few more
// tips. The intro's last slide, and the Feed's Tips button.
export default function NewUserTips({ back: backTo, className = '' }: { back: string; className?: string }) {
  const back = encodeURIComponent(backTo)
  const tiles = [
    { href: `/settings/assistant?next=${back}`, Icon: Sparkles, title: 'Connect an AI agent', text: 'Link an AI trip planner (like Muse, ChatGPT or Claude) to create and import itineraries for you.' },
    { href: '/plan?from=post&import=1', Icon: FileText, title: 'Import a trip', text: 'Upload a PDF, notes or an itinerary and we’ll turn it into a shareable trip.' },
    { href: `/settings/email?next=${back}`, Icon: Mail, title: 'Email it to Postcard', text: 'Forward itineraries, confirmations or notes to your own Postcard address and we’ll make a trip for you.' },
  ]
  return <div className={`space-y-3 ${className}`}>
    {tiles.map(({ href, Icon, title, text }) => <Link key={title} href={href} className="panel-hint flex items-center gap-4 p-4 text-left text-ink transition-colors hover:bg-mist-strong">
      <Icon size={28} strokeWidth={1.5} className="shrink-0 text-link" />
      <span className="min-w-0 flex-1"><span className="block text-base font-semibold">{title}</span><span className="mt-0.5 block text-sm leading-snug text-muted">{text}</span></span>
      <ChevronRight size={18} className="shrink-0 text-link" />
    </Link>)}
    <div className="rounded-2xl bg-cream p-4 text-left">
      <p className="flex items-center gap-2 text-base font-semibold text-ink"><Sparkles size={18} className="text-link" />More tips</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
        <li>Post a full trip or just your favorite spots</li>
        <li>Edit or reorder your itinerary anytime</li>
        <li>Keep trips private or share with friends</li>
        <li>Save places to a folder for later</li>
      </ul>
    </div>
  </div>
}
