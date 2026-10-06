'use client'

import { MapPin, Plus } from 'lucide-react'
import type { DestinationQuestion } from '@/lib/fileUnderDestination'

// "Which destination?": shown when a place being added doesn't clearly belong to one of the plan's destinations.
// Your destinations come nearest first, then the place's own town as a new destination.
// heading: false where the surrounding sheet already asks "Which destination?".
export default function WhichDestination({ question, place, chosen, onChoose, disabled = false, heading = true }: { question: DestinationQuestion; place: string; chosen?: string; onChoose: (destination: string) => void; disabled?: boolean; heading?: boolean }) {
  return <fieldset disabled={disabled} className="rounded-xl border border-line bg-card p-4">
    <legend className="sr-only">Which destination for {place}?</legend>
    {heading && <p className="field-label">Which destination?</p>}
    <p className={`${heading ? 'mt-1 ' : ''}text-sm text-muted`}>{place} is in {question.newName}. File it under:</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {question.options.map(option => <button key={option.id} type="button" aria-pressed={chosen === option.id} onClick={() => onChoose(option.id)} className="chip"><MapPin size={14} />{option.name}</button>)}
      <button type="button" aria-pressed={chosen === 'new'} onClick={() => onChoose('new')} className="chip"><Plus size={14} />New: {question.newName}</button>
    </div>
  </fieldset>
}
