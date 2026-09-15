'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Folder, Plus } from 'lucide-react'
import { deleteSavedFolder, saveFolder } from '@/actions/savedFolders'

type FolderSummary = { id: string; name: string; count: number }

export default function SavedFolders({ userId, folders, selected, total }: {
  userId: string; folders: FolderSummary[]; selected: string; total: number
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [pending, startTransition] = useTransition()
  const active = folders.find(folder => folder.id === selected)
  const base = `/user/${userId}?tab=bucket`
  const options = [{ id: '', name: 'All saved', count: total }, ...folders]

  return (
    <div className="mb-6 rounded-xl border border-[#E8D5B7] bg-[#FAF7F2] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-[#2C1810]"><Folder size={18} />Your folders</h2>
        <button type="button" disabled={pending} onClick={() => { setEditing('new'); setName(''); setError(''); setDeleting(false) }} className="flex items-center gap-1 text-sm text-[#5C3D2E]"><Plus size={16} />New folder</button>
      </div>
      <nav aria-label="Saved folders" className="flex flex-wrap gap-2">
        {options.map(folder => <Link key={folder.id} href={folder.id ? `${base}&folder=${encodeURIComponent(folder.id)}` : base} aria-current={selected === folder.id ? 'page' : undefined}
          className={`max-w-full rounded-lg border px-3 py-2 text-sm break-words ${selected === folder.id ? 'border-[#2C1810] bg-[#2C1810] text-white' : 'border-[#E8D5B7] text-[#5C3D2E] hover:bg-[#E8D5B7]'}`}>
          {folder.name} <span className="opacity-70">({folder.count})</span>
        </Link>)}
      </nav>
      {active && <div className="mt-3 flex gap-4 text-xs text-[#8B6F4E]">
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
            router.push(`${base}&folder=${encodeURIComponent(result.folder!.id)}`)
          } catch { setError('Could not save your folder. Please try again.') }
        })
      }}>
        <label className="block text-sm text-[#5C3D2E]">{editing === 'new' ? 'New folder name' : 'Folder name'}
          <input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Beach ideas" disabled={pending} className="mt-2 w-full rounded-lg border border-[#C4A882] bg-white px-3 py-2" />
        </label>
        <div className="mt-2 flex gap-3 text-sm">
          <button disabled={pending} className="rounded-lg bg-[#2C1810] px-4 py-2 text-white disabled:opacity-50">{pending ? 'Saving…' : editing === 'new' ? 'Create folder' : 'Save name'}</button>
          <button type="button" disabled={pending} onClick={() => { setEditing(null); setError('') }}>Cancel</button>
        </div>
      </form>}
      {deleting && active && <div className="mt-4 text-sm text-[#5C3D2E]">
        <p>Delete “{active.name}”? Its trips will stay in All saved.</p>
        <div className="mt-2 flex gap-3">
          <button type="button" disabled={pending} className="rounded-lg bg-red-700 px-3 py-2 text-white disabled:opacity-50" onClick={() => {
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
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  )
}
