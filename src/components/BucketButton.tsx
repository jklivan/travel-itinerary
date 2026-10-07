'use client'

import { useTransition, useState, useRef, useId, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { addToBucketList, removeFromBucketList } from '@/actions/bucketList'
import { getSavedFolders } from '@/actions/savedFolders'
import { useRouter } from 'next/navigation'
import { Bookmark, X } from 'lucide-react'

// The bookmark: save a trip (privately) to your Saved page, optionally into a folder. Liking is the heart.
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
  // The folder popup is rendered only while open, outside the card: card hearts sit inside the card's link.
  const [choosing, setChoosing] = useState(false)
  useEffect(() => { if (choosing) dialog.current?.showModal() }, [choosing])
  const titleId = useId()
  const router = useRouter()

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!isLoggedIn) {
      router.push(`/login?saveTrip=${encodeURIComponent(itineraryId)}`)
      return
    }

    if (withFolders) {
      setFolderError('')
      setFoldersLoaded(false)
      setChoosing(true)
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

  const label = bucketed ? 'Saved — change folder or remove' : 'Save trip'

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
        setFolderError('Could not remove this trip. Please try again.')
      }
    })
  }

  const folderDialog = choosing && typeof document !== 'undefined' ? createPortal(<dialog ref={dialog} onClose={() => setChoosing(false)} onClick={event => event.stopPropagation()} onCancel={event => { if (pending) event.preventDefault() }} aria-labelledby={titleId} className="m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-2xl bg-cream p-5 text-ink shadow-pop backdrop:bg-black/40">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={titleId} className="type-title">Save this trip</h2>
            <button type="button" aria-label="Close" disabled={pending} onClick={() => dialog.current?.close()} className="p-2"><X size={18} /></button>
          </div>
          <form onSubmit={saveWithFolder}>
            <label className="block text-sm">Save to folder <span className="text-brown">(optional)</span>
              <select value={folderId} onChange={event => setFolderId(event.target.value)} disabled={!foldersLoaded || pending} className="field mt-2">
                <option value="">All saved</option>
                {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            </label>
            <p className="mt-3 text-xs text-brown">Saved trips are private: they appear in your Saved page, in All saved or the folder you choose.</p>
            {folderError && <p role="alert" className="mt-3 text-sm text-danger">{folderError}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="submit" disabled={pending || !foldersLoaded} className="btn btn-primary flex-1">{pending ? 'Please wait…' : bucketed ? 'Update' : 'Save'}</button>
              {bucketed && <button type="button" onClick={unlikeTrip} disabled={pending} className="btn btn-outline text-danger">Remove</button>}
            </div>
          </form>
        </dialog>, document.body) : null

  if (size === 'md') {
    return (
      <>
        <button
          disabled={pending}
          onClick={handleClick}
          title={label}
          aria-label={label}
          aria-pressed={bucketed}
          className="chip"
        >
          <Bookmark size={15} className={bucketed ? 'fill-white' : ''} />
          {bucketed ? 'Saved' : 'Save'}
        </button>
        {folderDialog}
      </>
    )
  }

  return (
    <>
    <button
      disabled={pending}
      onClick={handleClick}
      title={label}
      aria-label={label}
      className={`flex min-h-8 items-center transition-colors ${bucketed ? 'text-ink' : 'text-ink hover:text-link'}`}
    >
      <Bookmark size={16} className={bucketed ? 'fill-ink' : ''} />
    </button>
    {folderDialog}
    </>
  )
}
