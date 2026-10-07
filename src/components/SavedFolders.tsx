'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Folder, Plus } from 'lucide-react'
import { deleteSavedFolder, saveFolder } from '@/actions/savedFolders'

type FolderSummary = { id: string; name: string; count: number }

export default function SavedFolders({ userId, folders, selected, total, basePath }: {
  userId: string; folders: FolderSummary[]; selected: string; total: number
  // Page the folder links point at. Defaults to the profile's Saved tab.
  basePath?: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [pending, startTransition] = useTransition()
  const active = folders.find(folder => folder.id === selected)
  const base = basePath ?? `/user/${userId}?tab=bucket`
  const folderHref = (id: string) => `${base}${base.includes('?') ? '&' : '?'}folder=${encodeURIComponent(id)}`
  const options = [{ id: '', name: 'All saved', count: total }, ...folders]

  return (
    <div className="mb-6 rounded-xl border border-sand bg-cream p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="type-label text-ink flex items-center gap-2"><Folder size={18} />Your folders</h2>
        <button type="button" disabled={pending} onClick={() => { setEditing('new'); setName(''); setError(''); setDeleting(false) }} className="chip"><Plus size={14} />New folder</button>
      </div>
      <nav aria-label="Saved folders" className="flex flex-wrap gap-2">
        {options.map(folder => <Link key={folder.id} href={folder.id ? folderHref(folder.id) : base} aria-current={selected === folder.id ? 'page' : undefined}
          aria-pressed={selected === folder.id}
          className="chip max-w-full whitespace-normal break-words">
          {folder.name} <span className="opacity-70">({folder.count})</span>
        </Link>)}
      </nav>
      {active && <div className="mt-3 flex gap-4 text-xs text-brown">
        <button type="button" disabled={pending} onClick={() => { setEditing(active.id); setName(active.name); setDeleting(false); setError('') }}>Rename folder</button>
        <button type="button" disabled={pending} onClick={() => { setDeleting(true); setEditing(null); setError('') }}>Delete folder</button>
      </div>}
      {editing !== null && <form className="mt-4" onSubmit={event => {
        event.preventDefault()
        setError('')
        startTransition(async () => {
          try {
            const result = await saveFolder(name, editing === 'new' ? undefined : editing)
            if (result.error) { setError(result.error); return }
            setEditing(null)
            router.push(folderHref(result.folder!.id))
          } catch { setError('Could not save your folder. Please try again.') }
        })
      }}>
        <label className="block text-sm text-ink-soft">{editing === 'new' ? 'New folder name' : 'Folder name'}
          <input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Beach ideas" disabled={pending} className="field mt-2" />
        </label>
        <div className="mt-2 flex gap-3 text-sm">
          <button disabled={pending} className="btn btn-primary">{pending ? 'Saving…' : editing === 'new' ? 'Create folder' : 'Save name'}</button>
          <button type="button" disabled={pending} onClick={() => { setEditing(null); setError('') }}>Cancel</button>
        </div>
      </form>}
      {deleting && active && <div className="mt-4 text-sm text-ink-soft">
        <p>Delete “{active.name}”? Its trips will stay in All saved.</p>
        <div className="mt-2 flex gap-3">
          <button type="button" disabled={pending} className="btn btn-danger btn-sm" onClick={() => {
            setError('')
            startTransition(async () => {
              try {
                const result = await deleteSavedFolder(active.id)
                if (result.error) { setError(result.error); return }
                setDeleting(false)
                router.push(base)
              } catch { setError('Could not delete this folder. Please try again.') }
            })
          }}>{pending ? 'Deleting…' : 'Delete folder'}</button>
          <button type="button" disabled={pending} onClick={() => { setDeleting(false); setError('') }}>Cancel</button>
        </div>
      </div>}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  )
}
