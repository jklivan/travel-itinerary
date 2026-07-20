'use client'

import { useTransition, useState } from 'react'
import { addToBucketList, removeFromBucketList } from '@/actions/bucketList'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'

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

  const label = bucketed ? 'Remove from saved' : 'Save'

  if (size === 'md') {
    return (
      <button
        onClick={handleClick}
        title={label}
        aria-label={label}
        className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
          bucketed
            ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
            : 'border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-500'
        }`}
      >
        <Heart size={15} className={bucketed ? 'fill-red-500 text-red-500' : ''} />
        {bucketed ? 'Saved' : 'Save'}
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
          ? 'bg-red-500 text-white scale-110'
          : 'bg-white/90 text-gray-400 hover:bg-red-50 hover:text-red-400'
      }`}
    >
      <Heart size={14} className={bucketed ? 'fill-white' : ''} />
    </button>
  )
}
