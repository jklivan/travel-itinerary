'use client'

export default function MoveToDay({ name, day, maxDay, onMove }: { name: string; day: number; maxDay: number; onMove: (day: number) => void }) {
  return <label className="flex items-center gap-2 px-3 py-2 text-xs text-[#507c76]">
    Move to day
    <select aria-label={`Move ${name} to day`} value={day} onChange={event => onMove(Number(event.target.value))} className="min-h-10 rounded-lg border border-[#bbcfc5] bg-[#fffdf6] px-2 text-sm">
      {Array.from({ length: Math.max(day, maxDay) }, (_, i) => <option key={i + 1} value={i + 1}>Day {i + 1}</option>)}
      <option value={Math.max(day, maxDay) + 1}>New day ({Math.max(day, maxDay) + 1})</option>
    </select>
  </label>
}
