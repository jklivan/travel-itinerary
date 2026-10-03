'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition, type ReactNode } from 'react'
import { Bookmark, Car, ChevronRight, Folder, MapPin, MountainSnow, Palmtree, Plus, Plane, Users, Utensils, Wine } from 'lucide-react'
import { deleteSavedFolder, saveFolder } from '@/actions/savedFolders'
import PostcardLogo from '@/components/PostcardLogo'

type FolderSummary = { id: string; name: string; count: number }

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

// Postmark wavy lines in a tile's corner.
function Postmark() {
  return <svg aria-hidden="true" viewBox="0 0 120 50" className="pointer-events-none absolute bottom-2 right-1 w-20 text-mist-edge opacity-70 sm:w-28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M4 12 Q19 4 34 12 T64 12 T94 12 T118 10M4 24 Q19 16 34 24 T64 24 T94 24 T118 22M4 36 Q19 28 34 36 T64 36 T94 36 T118 34" />
  </svg>
}

function Tile({ href, name, count, Icon, highlighted = false, decoration }: { href: string; name: string; count: number; Icon: typeof Folder; highlighted?: boolean; decoration: ReactNode }) {
  return <Link href={href} className={`relative flex min-h-[112px] items-center gap-2.5 overflow-hidden rounded-xl border p-3 pr-6 sm:min-h-[132px] sm:gap-3 sm:p-4 sm:pr-8 transition-shadow hover:shadow-md ${highlighted ? 'border-ink bg-mist' : 'border-line-soft bg-card'}`}>
    <span className="relative z-[1] flex size-11 shrink-0 items-center justify-center rounded-full bg-chip text-brown sm:size-14"><Icon size={22} strokeWidth={1.5} /></span>
    <span className="relative z-[1] min-w-0">
      <span className="block font-[family-name:var(--font-playfair)] text-[11px] uppercase leading-snug tracking-[0.12em] sm:text-[13px] sm:tracking-[0.16em] text-ink [overflow-wrap:anywhere]">{name}</span>
      <span className="mt-1 block text-sm tracking-wider text-muted">({count})</span>
    </span>
    <ChevronRight size={16} className="absolute right-2 top-3 text-ink sm:right-3 sm:top-4" />
    {decoration}
  </Link>
}

// The main Saved page: "All saved" and each folder as a tile, and a button to make a new folder.
export default function SavedFolderGrid({ folders, total }: { folders: FolderSummary[]; total: number }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  return <>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h1 className="font-[family-name:var(--font-playfair)] text-4xl uppercase tracking-[0.04em] text-ink">Saved</h1>
      <button type="button" disabled={pending} onClick={() => { setCreating(true); setName(''); setError('') }} className="btn btn-primary uppercase tracking-[0.16em]"><Plus size={18} />New folder</button>
    </div>
    <p className="mb-5 mt-2 text-xs uppercase tracking-[0.16em] text-muted">Trips you’ve saved, sorted into folders.</p>
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
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </form>}
    <nav aria-label="Saved folders" className="grid grid-cols-2 gap-2.5 sm:gap-3">
      <Tile href="/saved?folder=all" name="All saved" count={total} Icon={Bookmark} highlighted
        decoration={<PostcardLogo size={60} className="pointer-events-none absolute -bottom-3 right-2 rotate-[-10deg] opacity-45" />} />
      {folders.map((folder, index) => <Tile key={folder.id} href={`/saved?folder=${encodeURIComponent(folder.id)}`} name={folder.name} count={folder.count} Icon={folderIcon(folder.name)}
        decoration={index % 4 === 2 ? <PostcardLogo size={56} className="pointer-events-none absolute -bottom-4 right-2 rotate-[12deg] opacity-40" /> : <Postmark />} />)}
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
        <button type="button" disabled={pending} className="rounded-lg bg-red-700 px-3 py-2 text-white disabled:opacity-50" onClick={() => {
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
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>
}
