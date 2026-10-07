import { BookOpen, Building2, Car, Flower2, Gem, Heart, Landmark, Martini, Mountain, MountainSnow, PawPrint, Route, ShoppingBag, TreePine, Umbrella, Utensils, type LucideIcon } from 'lucide-react'
import { tagMeta } from '@/lib/tags'

const ICONS: Record<string, LucideIcon> = {
  'day-trip': Car, adventure: Mountain, beach: Umbrella, city: Building2, culture: Landmark, food: Utensils, history: BookOpen,
  luxury: Gem, nature: TreePine, nightlife: Martini, relaxing: Flower2, 'road-trip': Route, romantic: Heart, shopping: ShoppingBag,
  skiing: MountainSnow, wildlife: PawPrint,
}

// Also used for the other pills beside tags on a trip (verdict, budget, who it's for, months), so the row matches.
export const TAG_PILL = 'inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-label font-semibold uppercase tracking-[0.08em] transition-colors'

// A travel-style tag (Beach, Romantic, Skiing…): a line icon and the name in small capitals on a pale blue pill.
// The same pill when picking tags (onToggle: a button, navy when selected) and when showing them on a trip.
export default function TagChip({ id, selected = false, onToggle }: { id: string; selected?: boolean; onToggle?: () => void }) {
  const meta = tagMeta(id)
  if (!meta) return null
  const Icon = ICONS[meta.id]
  const content = <>{Icon && <Icon size={15} strokeWidth={1.5} aria-hidden="true" />}{meta.label}</>
  if (!onToggle) return <span className={`${TAG_PILL} bg-mist text-ink`}>{content}</span>
  return <button type="button" aria-pressed={selected} onClick={onToggle}
    className={`${TAG_PILL} ${selected ? 'bg-ink text-white' : 'bg-mist text-ink hover:bg-mist-strong'}`}>{content}</button>
}
