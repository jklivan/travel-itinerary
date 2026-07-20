'use client'

import { useTransition } from 'react'
import { addToBucketList, removeFromBucketList } from '@/actions/bucketList'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function BucketButton({
  itineraryId,
  initialBucketed,
  isLoggedIn,
  size = 'sm',
}: {
  itineraryId: string
  initialBucketed: boolean
  isLoggedIn: boolean
  size?: 'sm' | 'md'
}) {
  const [bucketed, setBucketed] = useState(initialBucketed)
  const [, startTransition] = useTransition()
  const router = useRouter()

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!isLoggedIn) {
      router.push('/login')
      return
    }

    const next = !bucketed
    setBucketed(next)
    startTransition(async () => {
      try {
        if (next) await addToBucketList(itineraryId)
        else await removeFromBucketList(itineraryId)
      } catch {
        setBucketed(!next) // revert on error
      }
    })
  }

  const label = bucketed ? 'Remove from bucket list' : 'Add to bucket list'

  if (size === 'md') {
    return (
      <button
        onClick={handleClick}
        title={label}
        aria-label={label}
        className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
          bucketed
            ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600'
            : 'border-gray-300 text-gray-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700'
        }`}
      >
        <span className="text-base">{bucketed ? '🪣' : '🪣'}</span>
        {bucketed ? 'In bucket list' : 'Add to bucket list'}
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      title={label}
      aria-label={label}
      className={`w-8 h-8 flex items-center justify-center rounded-full shadow-md transition-all ${
        bucketed
          ? 'bg-amber-400 text-white scale-110'
          : 'bg-white/90 text-gray-500 hover:bg-amber-50 hover:text-amber-600'
      }`}
    >
      <span className="text-sm leading-none">{bucketed ? '🪣' : '🪣'}</span>
    </button>
  )
}
