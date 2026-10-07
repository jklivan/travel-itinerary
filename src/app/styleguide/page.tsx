import type { Metadata } from 'next'
import { Plus, Trash2 } from 'lucide-react'
import TagChip from '@/components/ui/TagChip'
import Stamp from '@/components/ui/Stamp'
import { STAMP_COLORS } from '@/lib/tripStamps'

export const metadata: Metadata = { title: 'Style guide — Postcard', robots: { index: false } }

// The approved styles, in one place. Every screen should use only these (see AGENTS.md).
const TYPE = [
  { name: 'type-display', use: 'Page titles', sample: 'My trips', size: 'Serif · 32px (40px on desktop) · capitals' },
  { name: 'type-title', use: 'Section headings: “Places from the trip”, “Day 1”, “Hotels”', sample: 'Places from the trip', size: 'Serif · 22px · capitals' },
  { name: 'type-card', use: 'Trip and place names on cards', sample: 'Boat day with CT Watersports', size: 'Serif · 18px · capitals' },
  { name: 'type-body', use: 'Normal text, notes, descriptions', sample: 'Connecticut Watersports can book a boat for up to 10 people for waterskiing, tubing and wake boarding.', size: 'Sans · 14px' },
  { name: 'type-meta', use: 'Dates, counts, helper lines, “Saved by…”', sample: 'Sep 1, 2026 · 1 day · 3 places', size: 'Sans · 12px · muted' },
  { name: 'type-label', use: 'Small capital labels above fields and lists', sample: 'Who is this trip for?', size: 'Sans · 11px · semibold · capitals' },
  { name: 'type-micro', use: 'Badges, stamps, polaroid captions', sample: 'Explore · Stay · Must do!', size: 'Sans · 9px · semibold · capitals' },
]
const COLORS = ['ink', 'ink-soft', 'link', 'slate', 'muted', 'brown', 'terracotta', 'gold', 'gold-faint', 'danger', 'line', 'line-strong', 'line-soft', 'sand', 'chip', 'paper', 'cream', 'card', 'mist', 'mist-strong', 'mist-line', 'mist-edge']

export default function StyleGuide() {
  return <div className="page-narrow space-y-12">
    <header className="page-header"><h1 className="type-display">Style guide</h1><p className="page-subtitle">The only text styles, colours, buttons and page widths Postcard uses.</p></header>

    <section className="space-y-5"><h2 className="type-title">Text</h2>
      {TYPE.map(type => <div key={type.name} className="panel space-y-2 p-4">
        <p className={type.name}>{type.sample}</p>
        <p className="type-meta"><code className="font-semibold text-ink">{type.name}</code> · {type.size} — {type.use}</p>
      </div>)}
    </section>

    <section className="space-y-4"><h2 className="type-title">Colours</h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">{COLORS.map(color => <div key={color} className="space-y-1">
        <div className="h-12 rounded-xl border border-line" style={{ background: `var(--color-${color})` }} />
        <p className="type-meta">{color}</p>
      </div>)}</div>
    </section>

    <section className="space-y-4"><h2 className="type-title">Buttons and pills</h2>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary">Start planning →</button>
        <button type="button" className="btn btn-outline">Import notes</button>
        <button type="button" className="chip"><Plus size={14} />New folder</button>
        <button type="button" aria-pressed="true" className="chip">Selected</button>
        <button type="button" aria-label="Delete" className="btn-icon text-danger"><Trash2 size={16} /></button>
      </div>
      <div className="flex flex-wrap gap-2"><TagChip id="beach" /><TagChip id="romantic" /><TagChip id="skiing" /></div>
      <div className="flex gap-4 pt-2"><Stamp label="Must go!" color={STAMP_COLORS[5]} /><Stamp small label="Must do!" color={STAMP_COLORS[5]} /></div>
    </section>

    <section className="space-y-4"><h2 className="type-title">A card, put together</h2>
      <div className="panel flex gap-4 p-3">
        <span className="photo-polaroid w-24 shrink-0"><span className="photo-polaroid-image" /></span>
        <span className="min-w-0 space-y-1"><span className="type-micro block text-terracotta">Food &amp; drink</span><span className="type-card block">Il Focolare</span><span className="type-meta block">Barano d’Ischia, Italy</span><span className="type-body block">Order the rabbit; book a day ahead.</span></span>
      </div>
    </section>

    <section className="space-y-3"><h2 className="type-title">Page widths</h2>
      <p className="type-body"><code className="font-semibold">page-narrow</code> (640px): Feed, Explore, My Trips, Saved, Profile, Messages, forms.</p>
      <p className="type-body"><code className="font-semibold">page-wide</code> (900px): a trip page and the planner.</p>
      <p className="type-body">Full screen: the welcome screen, maps, snapshots.</p>
    </section>
  </div>
}
