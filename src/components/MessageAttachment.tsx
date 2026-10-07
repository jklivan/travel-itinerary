import Link from 'next/link'
import { MapPin } from 'lucide-react'

export default function MessageAttachment({ name, trip, notes, href, kind = 'place' }: { name: string; trip?: string | null; notes?: string | null; href?: string; kind?: 'place' | 'trip' }) {
  return (
    <div className="rounded-sm border border-line-soft border-t-2 border-t-link bg-card p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mist text-link"><MapPin size={19} strokeWidth={1.5} /></span>
        <div className="min-w-0">
          <p className="text-label font-semibold uppercase tracking-widest text-link">{kind === 'trip' ? 'About this trip' : 'Place from the trip'}</p>
          <p className="font-[family-name:var(--font-playfair)] text-lg leading-snug text-ink break-words">{name}</p>
          {trip && <p className="mt-1 text-xs text-brown break-words">{trip}</p>}
        </div>
      </div>
      {notes && <blockquote className="mt-3 border-l-2 border-line-strong pl-3 text-sm leading-relaxed text-muted whitespace-pre-wrap break-words">{notes}</blockquote>}
      {href && <Link className="mt-3 inline-block text-sm font-semibold text-link hover:underline" href={href}>{kind === 'trip' ? 'View trip →' : 'View place in trip →'}</Link>}
    </div>
  )
}
