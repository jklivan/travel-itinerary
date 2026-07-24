'use client'

import { useState, useTransition } from 'react'
import { deleteItinerary } from '@/actions/itinerary'
import { Trash2 } from 'lucide-react'

export default function DeleteButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteItinerary(id)
    })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Delete this post?</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs font-medium px-3 py-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:border-gray-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors"
    >
      <Trash2 size={13} />
      Delete
    </button>
  )
}
