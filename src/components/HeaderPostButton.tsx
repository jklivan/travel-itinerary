'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import PostTripDialog from './PostTripDialog'

// The header's + (left of the logo): opens the Post flow — post one of your plans or start a new trip.
export default function HeaderPostButton() {
  const [posting, setPosting] = useState(false)
  return <>
    <button type="button" aria-label="Post a trip" aria-haspopup="dialog" onClick={() => setPosting(true)}
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#4d6a8c] text-white shadow-sm transition-colors hover:bg-[#3f5b7c]">
      <Plus size={24} />
    </button>
    {posting && <PostTripDialog onClose={() => setPosting(false)} />}
  </>
}
