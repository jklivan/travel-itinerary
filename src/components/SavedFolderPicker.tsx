'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { Folder, X } from 'lucide-react'
import { getSavedFolders, saveFolder } from '@/actions/savedFolders'
import { addToBucketList } from '@/actions/bucketList'

type FolderOption = { id: string; name: string }

export default function SavedFolderPicker({ itineraryId, label = 'Save to folder' }: { itineraryId: string; label?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [folders, setFolders] = useState<FolderOption[]>([])
  const [folderId, setFolderId] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [pending, startTransition] = useTransition()

  function open() {
    setError('')
    setLoaded(false)
    setName('')
    dialog.current?.showModal()
    startTransition(async () => {
      try {
        const result = await getSavedFolders(itineraryId)
        if (result.error) { setError(result.error); return }
        setFolders(result.folders!)
        setFolderId(result.folderId ?? '')
        setLoaded(true)
      } catch { setError('Could not load your folders. Close and try again.') }
    })
  }

  return (
    <>
      <button type="button" onClick={open} className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#C4A882] px-4 py-2 text-sm text-[#5C3D2E] hover:bg-[#E8D5B7]">
        <Folder size={15} className="shrink-0" /><span className="truncate">{label}</span>
      </button>
      <dialog ref={dialog} onCancel={event => { if (pending) event.preventDefault() }} aria-labelledby={titleId} className="m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-2xl bg-[#FAF7F2] p-5 text-[#2C1810] shadow-xl backdrop:bg-black/40">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">Save to folder</h2>
          <button type="button" aria-label="Close folder picker" disabled={pending} onClick={() => dialog.current?.close()} className="p-2"><X size={18} /></button>
        </div>
        <form onSubmit={event => {
          event.preventDefault()
          setError('')
          startTransition(async () => {
            try {
              let selected = folderId
              if (selected === 'new') {
                const created = await saveFolder(name)
                if (created.error) { setError(created.error); return }
                selected = created.folder!.id
                setFolders(current => [...current, created.folder!])
                setFolderId(selected)
              }
              const result = await addToBucketList(itineraryId, selected || null)
              if (result?.error) { setError(result.error); return }
              dialog.current?.close()
            } catch { setError('Could not save this trip to the folder. Please try again.') }
          })
        }}>
          <label className="block text-sm">Folder
            <select value={folderId} onChange={event => setFolderId(event.target.value)} disabled={!loaded || pending} className="mt-2 w-full rounded-lg border border-[#C4A882] bg-white p-3">
              <option value="">Unfiled</option>
              {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              <option value="new">+ Create new folder</option>
            </select>
          </label>
          {folderId === 'new' && <label className="mt-4 block text-sm">New folder name
            <input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Beach ideas" disabled={pending} className="mt-2 w-full rounded-lg border border-[#C4A882] bg-white p-3" />
          </label>}
          <p className="mt-3 text-xs text-[#8B6F4E]">Folders are only visible to you. Trips also appear in All saved.</p>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={pending || !loaded} className="mt-5 w-full rounded-lg bg-[#2C1810] px-4 py-3 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Please wait…' : 'Save'}</button>
        </form>
      </dialog>
    </>
  )
}
