'use client'

import { TAGS } from '@/lib/tags'
import TagChip from '@/components/ui/TagChip'

export default function TagPicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (tags: string[]) => void
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id])
  }

  // The shared tag pill (ui/TagChip), as on the trip page.
  return <div className="flex flex-wrap gap-2">
    {TAGS.map(tag => <TagChip key={tag.id} id={tag.id} selected={selected.includes(tag.id)} onToggle={() => toggle(tag.id)} />)}
  </div>
}
