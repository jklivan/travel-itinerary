import { Check, ChevronRight } from 'lucide-react'

const TILTS = [-2, 1.5, -1, 2, 1, -1.5, 2, -2]

// An option shown as a small polaroid: white frame, square photo, then the label in small capitals and a tick circle
// (or an arrow, for links). Explore's cards, Search by trip type, and the new-plan choices. Photo polaroids for real
// photos are different: .photo-polaroid in globals.css. Wrap this in the button, link or checkbox label that does the choosing.
// size: 'sm' for four across, 'lg' for two across. photoPosition / photoSize pick one photo out of a combined image.
// labelStyle 'serif': the label in the title serif, as on Explore's four cards; otherwise small capitals.
export default function PolaroidTile({ photo, label, selected = false, index = 0, dimmed = false, trailing = 'tick', size = 'sm', photoPosition, photoSize, labelStyle = 'caps' }: {
  photo: string; label: string; selected?: boolean; index?: number; dimmed?: boolean; trailing?: 'tick' | 'arrow'; size?: 'sm' | 'lg'; photoPosition?: string; photoSize?: string; labelStyle?: 'caps' | 'serif'
}) {
  return <span style={{ transform: `rotate(${TILTS[index % TILTS.length]}deg)` }} className={[
    'block select-none border bg-card text-left shadow-card transition-all',
    size === 'lg' ? 'p-1.5 pb-0' : 'p-1 pb-0',
    selected ? 'border-link ring-2 ring-link' : 'border-line-soft',
    dimmed ? 'opacity-60' : '',
  ].join(' ')}>
    <span className="block aspect-square w-full bg-cover bg-center" style={{ backgroundImage: `url(${photo})`, ...(photoPosition ? { backgroundPosition: photoPosition } : {}), ...(photoSize ? { backgroundSize: photoSize } : {}) }} aria-hidden="true" />
    {/* The label's size follows the tile's width (container units), so long words fit beside the tick on small phones. */}
    <span className={`@container flex w-full items-center justify-between gap-1 px-0.5 ${size === 'lg' ? 'min-h-11 py-1.5' : 'min-h-8 py-1'}`}>
      <span className={labelStyle === 'serif' ? 'min-w-0 font-[family-name:var(--font-playfair)] text-base sm:text-lg leading-[1.12] tracking-normal text-ink' : `min-w-0 font-semibold uppercase leading-tight tracking-wider text-ink ${size === 'lg' ? 'text-[clamp(8px,calc((100cqw-30px)/9),11px)]' : 'text-[clamp(6.5px,calc((100cqw-17px)/6.6),9px)]'}`}>{label}</span>
      {trailing === 'arrow'
        ? <span className="grid size-6 shrink-0 place-items-center rounded-full bg-chip text-ink"><ChevronRight size={16} /></span>
        : <span className={`grid shrink-0 place-items-center rounded-full border ${size === 'lg' ? 'size-4' : 'size-3.5'} ${selected ? 'border-link bg-link text-white' : 'border-ink-soft text-transparent'}`}><Check size={12} strokeWidth={3} /></span>}
    </span>
  </span>
}
