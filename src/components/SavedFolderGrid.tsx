'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Bookmark, Car, ChevronRight, Folder, MapPin, MountainSnow, Palmtree, Plus, Plane, Users, Utensils, Wine } from 'lucide-react'
import { deleteSavedFolder, saveFolder } from '@/actions/savedFolders'
import { sizedPhoto } from '@/lib/photoSizing'

type FolderSummary = { id: string; name: string; count: number; photo: string | null }

// A folder's icon, guessed from its name.
function folderIcon(name: string) {
  const text = name.toLowerCase()
  if (/couple|romantic|honeymoon|date/.test(text)) return Wine
  if (/family|kid/.test(text)) return Users
  if (/ski|snow|mountain/.test(text)) return MountainSnow
  if (/beach|island|tropical/.test(text)) return Palmtree
  if (/road|drive|car/.test(text)) return Car
  if (/food|eat|restaurant/.test(text)) return Utensils
  if (/local|nearby|excursion|weekend/.test(text)) return MapPin
  if (/abroad|europe|international|flight/.test(text)) return Plane
  return Folder
}

// A folder row: a photo polaroid from one of its trips (or the folder's icon when it's empty), the name, and how many trips.
function Row({ href, name, count, photo, Icon }: { href: string; name: string; count: number; photo: string | null; Icon: typeof Folder }) {
  return <Link href={href} className="flex items-center gap-4 border-b border-line-soft py-3 transition-colors last:border-b-0 hover:bg-cream">
    <span className="photo-polaroid w-16 shrink-0">
      <span className="photo-polaroid-image grid place-items-center text-brown">
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={sizedPhoto(photo, 256)} alt="" className="absolute inset-0" />
          : <Icon size={22} strokeWidth={1.5} />}
      </span>
    </span>
    <span className="min-w-0 flex-1">
      <span className="block font-[family-name:var(--font-playfair)] text-sm uppercase leading-snug tracking-[0.14em] text-ink [overflow-wrap:anywhere]">{name}</span>
      <span className="mt-1 block text-sm text-muted">{count} {count === 1 ? 'trip' : 'trips'}</span>
    </span>
    <ChevronRight size={18} className="shrink-0 text-ink" />
  </Link>
}

// The main Saved page: "All saved" and each folder as a tile, and a button to make a new folder.
export default function SavedFolderGrid({ folders, total, allPhoto }: { folders: FolderSummary[]; total: number; allPhoto: string | null }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  return <>
    <header className="page-header">
      <h1 className="page-title">Saved</h1>
      <p className="page-subtitle">Trips you’ve saved, sorted into folders.</p>
    </header>
    {!creating && <button type="button" disabled={pending} onClick={() => { setCreating(true); setName(''); setError('') }} className="chip mb-5"><Plus size={14} />New folder</button>}
    {creating && <form className="mb-5 rounded-xl border border-line-soft bg-card p-4" onSubmit={event => {
      event.preventDefault(); setError('')
      startTransition(async () => {
        try {
          const result = await saveFolder(name)
          if (result.error) { setError(result.error); return }
          setCreating(false); router.refresh()
        } catch { setError('Could not create your folder. Please try again.') }
      })
    }}>
      <label className="block text-sm text-ink-soft">New folder name
        <input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Ski trips" disabled={pending} className="mt-2 w-full rounded-lg border border-line-strong bg-white px-3 py-2" />
      </label>
      <div className="mt-3 flex gap-3 text-sm">
        <button disabled={pending} className="btn btn-primary">{pending ? 'Creating…' : 'Create folder'}</button>
        <button type="button" disabled={pending} onClick={() => setCreating(false)}>Cancel</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </form>}
    <nav aria-label="Saved folders" className="panel px-4">
      <Row href="/saved?folder=all" name="All saved" count={total} photo={allPhoto} Icon={Bookmark} />
      {folders.map(folder => <Row key={folder.id} href={`/saved?folder=${encodeURIComponent(folder.id)}`} name={folder.name} count={folder.count} photo={folder.photo} Icon={folderIcon(folder.name)} />)}
    </nav>
  </>
}

// Inside a folder: rename or delete it.
export function SavedFolderActions({ folder }: { folder: { id: string; name: string } }) {
  const router = useRouter()
  const [mode, setMode] = useState<'rename' | 'delete' | null>(null)
  const [name, setName] = useState(folder.name)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  return <div className="mb-5">
    {!mode && <div className="flex gap-4 text-xs text-brown">
      <button type="button" onClick={() => { setMode('rename'); setName(folder.name); setError('') }}>Rename folder</button>
      <button type="button" onClick={() => { setMode('delete'); setError('') }}>Delete folder</button>
    </div>}
    {mode === 'rename' && <form className="rounded-xl border border-line-soft bg-card p-4" onSubmit={event => {
      event.preventDefault(); setError('')
      startTransition(async () => {
        try {
          const result = await saveFolder(name, folder.id)
          if (result.error) { setError(result.error); return }
          setMode(null); router.refresh()
        } catch { setError('Could not rename your folder. Please try again.') }
      })
    }}>
      <label className="block text-sm text-ink-soft">Folder name
        <input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)} disabled={pending} className="mt-2 w-full rounded-lg border border-line-strong bg-white px-3 py-2" />
      </label>
      <div className="mt-3 flex gap-3 text-sm">
        <button disabled={pending} className="btn btn-primary">{pending ? 'Saving…' : 'Save name'}</button>
        <button type="button" disabled={pending} onClick={() => setMode(null)}>Cancel</button>
      </div>
    </form>}
    {mode === 'delete' && <div className="rounded-xl border border-line-soft bg-card p-4 text-sm text-ink-soft">
      <p>Delete “{folder.name}”? Its trips will stay in All saved.</p>
      <div className="mt-3 flex gap-3">
        <button type="button" disabled={pending} className="rounded-lg bg-danger px-3 py-2 text-white disabled:opacity-50" onClick={() => {
          setError('')
          startTransition(async () => {
            try {
              const result = await deleteSavedFolder(folder.id)
              if (result.error) { setError(result.error); return }
              router.push('/saved')
            } catch { setError('Could not delete this folder. Please try again.') }
          })
        }}>{pending ? 'Deleting…' : 'Delete folder'}</button>
        <button type="button" disabled={pending} onClick={() => setMode(null)}>Cancel</button>
      </div>
    </div>}
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </div>
}
