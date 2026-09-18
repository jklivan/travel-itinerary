'use client'

import { useTransition, useState, useRef, useId } from 'react'
import { addToBucketList, removeFromBucketList } from '@/actions/bucketList'
import { getSavedFolders } from '@/actions/savedFolders'
import { useRouter } from 'next/navigation'
import { Heart, X } from 'lucide-react'

export default function BucketButton({
  itineraryId,
  initialBucketed,
  isLoggedIn,
  size = 'sm',
  withFolders = false,
}: {
  itineraryId: string
  initialBucketed: boolean
  isLoggedIn: boolean
  size?: 'sm' | 'md'
  withFolders?: boolean
}) {
  const [bucketed, setBucketed] = useState(initialBucketed)
  const [pending, startTransition] = useTransition()
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([])
  const [folderId, setFolderId] = useState('')
  const [folderError, setFolderError] = useState('')
  const [foldersLoaded, setFoldersLoaded] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const router = useRouter()

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!isLoggedIn) {
      router.push(`/login?saveTrip=${encodeURIComponent(itineraryId)}`)
      return
    }

    if (withFolders && size === 'md') {
      setFolderError('')
      setFoldersLoaded(false)
      dialog.current?.showModal()
      startTransition(async () => {
        try {
          const result = await getSavedFolders(itineraryId)
          if (result.error) { setFolderError(result.error); return }
          setFolders(result.folders ?? [])
          setFolderId(result.folderId ?? '')
          setFoldersLoaded(true)
        } catch {
          setFolderError('Could not load your folders. Close and try again.')
        }
      })
      return
    }

    const next = !bucketed
    setBucketed(next)
    startTransition(async () => {
      try {
        const result = next ? await addToBucketList(itineraryId) : await removeFromBucketList(itineraryId)
        if (result?.error) setBucketed(!next)
      } catch {
        setBucketed(!next) // revert on error
      }
    })
  }

  const label = bucketed ? 'Unlike trip' : 'Like trip'

  function saveWithFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFolderError('')
    startTransition(async () => {
      try {
        const result = await addToBucketList(itineraryId, folderId || null)
        if (result?.error) { setFolderError(result.error); return }
        setBucketed(true)
        dialog.current?.close()
      } catch {
        setFolderError('Could not save this trip. Please try again.')
      }
    })
  }

  function unlikeTrip() {
    startTransition(async () => {
      try {
        const result = await removeFromBucketList(itineraryId)
        if (result?.error) { setFolderError(result.error); return }
        setBucketed(false)
        setFolderId('')
        dialog.current?.close()
      } catch {
        setFolderError('Could not unlike this trip. Please try again.')
      }
    })
  }

  if (size === 'md') {
    return (
      <>
        <button
          disabled={pending}
          onClick={handleClick}
          title={withFolders ? 'Like trip and choose a folder' : label}
          aria-label={withFolders ? 'Like trip and choose a folder' : label}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
            bucketed
              ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
              : 'border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-500'
          }`}
        >
          <Heart size={15} className={bucketed ? 'fill-red-500 text-red-500' : ''} />
          {bucketed ? 'Liked' : 'Like'}
        </button>
        {withFolders && <dialog ref={dialog} onCancel={event => { if (pending) event.preventDefault() }} aria-labelledby={titleId} className="m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-2xl bg-[#faf7f1] p-5 text-[#242e25] shadow-xl backdrop:bg-black/40">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-lg font-semibold">Like this trip</h2>
            <button type="button" aria-label="Close" disabled={pending} onClick={() => dialog.current?.close()} className="p-2"><X size={18} /></button>
          </div>
          <form onSubmit={saveWithFolder}>
            <label className="block text-sm">Save to folder <span className="text-[#8B6F4E]">(optional)</span>
              <select value={folderId} onChange={event => setFolderId(event.target.value)} disabled={!foldersLoaded || pending} className="mt-2 w-full rounded-lg border border-[#c1ad93] bg-white p-3">
                <option value="">All saved</option>
                {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            </label>
            <p className="mt-3 text-xs text-[#8B6F4E]">Liked trips appear in All saved. Choose a folder to organize this trip.</p>
            {folderError && <p role="alert" className="mt-3 text-sm text-red-700">{folderError}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="submit" disabled={pending || !foldersLoaded} className="min-h-11 flex-1 rounded-lg bg-[#242e25] px-4 py-3 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Please wait…' : bucketed ? 'Update saved trip' : 'Like & save'}</button>
              {bucketed && <button type="button" onClick={unlikeTrip} disabled={pending} className="min-h-11 rounded-lg border border-red-200 px-4 py-3 text-sm font-medium text-red-700 disabled:opacity-50">Unlike</button>}
            </div>
          </form>
        </dialog>}
      </>
    )
  }

  return (
    <button
      disabled={pending}
      onClick={handleClick}
      title={label}
      aria-label={label}
      className={`w-8 h-8 flex items-center justify-center rounded-full shadow-md transition-colors ${
        bucketed
          ? 'bg-red-500 text-white'
          : 'bg-white/90 text-gray-400 hover:bg-red-50 hover:text-red-400'
      }`}
    >
      <Heart size={14} className={bucketed ? 'fill-white' : ''} />
    </button>
  )
}
