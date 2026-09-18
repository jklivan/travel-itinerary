import Link from 'next/link'
import { MapPin } from 'lucide-react'

export default function MessageAttachment({ name, trip, notes, href, kind = 'place' }: { name: string; trip?: string | null; notes?: string | null; href?: string; kind?: 'place' | 'trip' }) {
  return (
    <div className="rounded-sm border border-[#d7dcd0] border-t-2 border-t-[#59694f] bg-[#fffdf6] p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e6ece5] text-[#59694f]"><MapPin size={19} strokeWidth={1.5} /></span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#59694f]">{kind === 'trip' ? 'About this trip' : 'Place from the trip'}</p>
          <p className="font-[family-name:var(--font-playfair)] text-lg leading-snug text-[#2e4147] break-words">{name}</p>
          {trip && <p className="mt-1 text-xs text-[#8B6F4E] break-words">{trip}</p>}
        </div>
      </div>
      {notes && <blockquote className="mt-3 border-l-2 border-[#c1ad93] pl-3 text-sm leading-relaxed text-[#6b7067] whitespace-pre-wrap break-words">{notes}</blockquote>}
      {href && <Link className="mt-3 inline-block text-sm font-semibold text-[#59694f] hover:underline" href={href}>{kind === 'trip' ? 'View trip →' : 'View place in trip →'}</Link>}
    </div>
  )
}
