'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { setDayOrder } from '@/actions/planning'

function Row({ id, name, children }: { id: string; name: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative flex items-stretch gap-1 ${isDragging ? 'z-10 opacity-90' : ''}`}>
    {/* Drag by the handle only, so scrolling, tapping and swipe-to-delete on the card still work. */}
    <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} data-no-swipe aria-label={`Move ${name}`}
      className="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center text-muted hover:text-ink active:cursor-grabbing">
      <GripVertical size={18} />
    </button>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
}

// One day's places in order. Drag a place by its handle to move it up or down the day; the new order is saved.
export default function SortableDay<T extends { id: string; name: string }>({ tripId, places, render }: { tripId: string; places: T[]; render: (place: T) => ReactNode }) {
  const router = useRouter()
  const [order, setOrder] = useState<string[] | null>(null)
  const [error, setError] = useState('')
  const [, startTransition] = useTransition()
  // A local order only while a save is on its way; otherwise the server's.
  const ids = order && order.length === places.length && order.every(id => places.some(place => place.id === id)) ? order : places.map(place => place.id)
  const byId = new Map(places.map(place => [place.id, place]))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    setOrder(next); setError('')
    startTransition(async () => {
      const result = await setDayOrder(tripId, next).catch(() => ({ error: 'Could not reorder. Please try again.' }))
      if ('error' in result && result.error) { setError(result.error); setOrder(null) } else router.refresh()
    })
  }
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <div className="space-y-3">{ids.map(id => { const place = byId.get(id); return place ? <Row key={id} id={id} name={place.name}>{render(place)}</Row> : null })}</div>
    </SortableContext>
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </DndContext>
}
