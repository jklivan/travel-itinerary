'use client'

import { createContext, useContext, useRef, useState, useTransition, type KeyboardEventHandler, type MouseEventHandler, type ReactNode, type TouchEventHandler } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { setDayOrder } from '@/actions/planning'

// When the last drag ended, so the click that follows letting go doesn't also open the card.
const DragEnded = createContext<{ current: number }>({ current: 0 })

function Row({ id, name, children }: { id: string; name: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const dragEnded = useContext(DragEnded)
  // Press and hold anywhere on the card to pick it up (a quick tap, scroll or swipe still works as before). The
  // keyboard moves it with a button that only shows when it has focus.
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
    onMouseDown={listeners?.onMouseDown as MouseEventHandler | undefined} onTouchStart={listeners?.onTouchStart as TouchEventHandler | undefined}
    onClickCapture={event => { if (Date.now() - dragEnded.current < 400) { event.preventDefault(); event.stopPropagation() } }}
    className={`relative select-none [-webkit-touch-callout:none] [&_input]:select-text [&_textarea]:select-text ${isDragging ? 'z-10 scale-[1.02] rounded-2xl shadow-pop' : ''}`}>
    <button type="button" ref={setActivatorNodeRef} {...attributes} onKeyDown={listeners?.onKeyDown as KeyboardEventHandler | undefined} aria-label={`Move ${name}`} className="sr-only focus:not-sr-only focus:mb-2 focus:text-sm focus:text-link">Move {name}</button>
    {children}
  </div>
}

// One day's places in order. Press and hold a place to move it up or down the day; the new order is saved.
export default function SortableDay<T extends { id: string; name: string }>({ tripId, places, render }: { tripId: string; places: T[]; render: (place: T) => ReactNode }) {
  const router = useRouter()
  const [order, setOrder] = useState<string[] | null>(null)
  const [error, setError] = useState('')
  const [, startTransition] = useTransition()
  const dragEnded = useRef(0)
  // A local order only while a save is on its way; otherwise the server's.
  const ids = order && order.length === places.length && order.every(id => places.some(place => place.id === id)) ? order : places.map(place => place.id)
  const byId = new Map(places.map(place => [place.id, place]))
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  function onDragEnd({ active, over }: DragEndEvent) {
    dragEnded.current = Date.now()
    if (!over || active.id === over.id) return
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    setOrder(next); setError('')
    startTransition(async () => {
      const result = await setDayOrder(tripId, next).catch(() => ({ error: 'Could not reorder. Please try again.' }))
      if ('error' in result && result.error) { setError(result.error); setOrder(null) } else router.refresh()
    })
  }
  return <DragEnded.Provider value={dragEnded}><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} onDragCancel={() => { dragEnded.current = Date.now() }}>
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <div className="space-y-3">{ids.map(id => { const place = byId.get(id); return place ? <Row key={id} id={id} name={place.name}>{render(place)}</Row> : null })}</div>
    </SortableContext>
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </DndContext></DragEnded.Provider>
}
