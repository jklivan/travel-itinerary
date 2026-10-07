'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { Camera } from 'lucide-react'
import { compressPhoto } from '@/lib/photoSizing'
import { setProfilePhoto } from '@/actions/profilePhoto'
import UserAvatar from './UserAvatar'

// Profile header: your photo (or initials) with a camera button to add, change or remove it.
export default function ProfilePhotoPicker({ name, image }: { name: string; image: string | null }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(next: string | null) {
    const result = await setProfilePhoto(next)
    if (result.error) setError(result.error); else router.refresh()
  }
  return <div className="flex shrink-0 flex-col items-center gap-1">
    <button type="button" disabled={busy} onClick={() => input.current?.click()} aria-label={image ? 'Change profile photo' : 'Add profile photo'} className="relative rounded-full disabled:opacity-60">
      <UserAvatar name={name} image={image} size={64} className="text-title" />
      <span className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full border-2 border-paper bg-ink text-white"><Camera size={12} /></span>
    </button>
    <input ref={input} type="file" accept="image/*" hidden onChange={async event => {
      const picked = event.target.files?.[0]
      event.target.value = ''
      if (!picked) return
      setBusy(true); setError('')
      try {
        const file = await compressPhoto(picked)
        if (file.size > 10 * 1024 * 1024) { setError('Choose a photo under 10 MB.'); return }
        const blob = await upload(`profile-${crypto.randomUUID()}-${file.name}`, file, { access: 'private', handleUploadUrl: '/api/upload' })
        await save(`/api/img?url=${encodeURIComponent(blob.url)}`)
      } catch { setError('Could not upload your photo. Please try again.') } finally { setBusy(false) }
    }} />
    <span className="text-label text-link">{busy ? 'Uploading…' : image ? <button type="button" onClick={() => { setBusy(true); void save(null).finally(() => setBusy(false)) }} className="underline">Remove</button> : 'Add photo'}</span>
    {error && <p role="alert" className="max-w-40 text-center text-xs text-danger">{error}</p>}
  </div>
}
