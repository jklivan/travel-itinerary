'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { activeStories, deleteStory } from '@/actions/stories'
import { groupStories, type StoryCard } from '@/lib/stories'
import StoryComposer from './StoryComposer'
import SavePlaceToPlan from './SavePlaceToPlan'
import styles from './Stories.module.css'

export default function StoriesBar({ stories, userId, following, serverTime }: { stories: StoryCard[]; userId: string | null; following: boolean; serverTime: number }) {
  const router = useRouter()
  const [now, setNow] = useState(serverTime)
  const [composing, setComposing] = useState(false)
  const [viewer, setViewer] = useState<{ stories: StoryCard[]; id: string } | null>(null)
  const [loading, setLoading] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    const update = () => setNow(Date.now())
    const timer = setInterval(update, 1000)
    window.addEventListener('focus', update)
    return () => { clearInterval(timer); window.removeEventListener('focus', update) }
  }, [])
  const visible = stories.filter(story => Date.parse(story.expiresAt) > now)
  const groups = groupStories(visible, userId)

  return <section aria-label="24-hour stories" className={styles.bar}>
    <div className={styles.barHeading}><h2>Little moments</h2><span>Polaroids · 24h</span></div>
    <div className={styles.tray}>
      {userId ? <button type="button" className={styles.addStory} onClick={() => { setMessage(''); setComposing(true) }}><span><Plus size={25} /></span>Your story</button> : <Link href="/login" className={styles.addStory}><span><Plus size={25} /></span>Your story</Link>}
      {groups.map(group => { const latest = group.items.at(-1)!; return <button key={group.authorId} type="button" className={styles.storyThumb} disabled={!!loading} aria-label={`View ${group.authorId === userId ? 'your' : latest.authorName + '’s'} stories, ${group.items.length} ${group.items.length === 1 ? 'story' : 'stories'}`} onClick={async () => {
        setLoading(group.authorId); setMessage('')
        try {
          const current = await activeStories(following)
          const ordered = groupStories(current, userId).flatMap(group => group.items)
          const first = ordered.find(story => story.authorId === group.authorId)
          if (first) setViewer({ stories: ordered, id: first.id })
          else { setMessage('This story has expired or is no longer available.'); router.refresh() }
        } catch { setMessage('Could not open stories. Please try again.') }
        finally { setLoading('') }
      }}><span className={styles.miniPaper}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={latest.photoUrl} alt="" /><i>{loading === group.authorId ? '…' : group.items.length > 1 ? group.items.length : ''}</i>
      </span><span className={styles.author}>{group.authorId === userId ? 'You' : latest.authorName}</span></button> })}
      {!groups.length && <p className={styles.trayHint}>A hotel you loved.<br />A meal to remember.<br />Share a little moment.</p>}
    </div>
    {message && <p role="status" className={styles.message}>{message}</p>}
    {composing && <StoryComposer onClose={() => setComposing(false)} onPosted={() => { setComposing(false); setMessage('Your story is posted for 24 hours.'); router.refresh() }} />}
    {viewer && <StoryViewer stories={viewer.stories} initialId={viewer.id} userId={userId} now={now} onClose={() => { setViewer(null); router.refresh() }} />}
  </section>
}

function StoryViewer({ stories, initialId, userId, now, onClose }: { stories: StoryCard[]; initialId: string; userId: string | null; now: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [selected, setSelected] = useState(initialId)
  const [removed, setRemoved] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saved, setSaved] = useState<string[]>([])
  const [error, setError] = useState('')
  const touch = useRef<{ x: number; y: number } | null>(null)
  const available = stories.filter(story => Date.parse(story.expiresAt) > now && !removed.includes(story.id))
  const index = available.findIndex(story => story.id === selected)
  const story = available[index]
  const authorStories = story ? available.filter(item => item.authorId === story.authorId) : []
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    const previous = document.body.style.overflow
    if (previous !== 'hidden') document.body.style.overflow = 'hidden'
    return () => { element?.close(); if (previous !== 'hidden') document.body.style.overflow = previous }
  }, [])
  function move(offset: number) {
    if (deleting || saveOpen) return
    const next = available[index + offset]
    if (next) { setSelected(next.id); setConfirmDelete(false); setError('') }
  }
  const minutes = story ? Math.max(0, Math.floor((now - Date.parse(story.createdAt)) / 60000)) : 0
  const age = minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`

  return <>
    <dialog ref={dialog} className={styles.viewer} aria-labelledby={titleId} onClose={onClose} onKeyDown={event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
    }}>
      <div className={styles.viewerInner}>
        <header className={styles.viewerHeader}><div><h2 id={titleId}>{story?.authorName ?? 'Story expired'}</h2><p>{story ? age : 'Stories disappear after 24 hours.'}</p></div><button type="button" autoFocus className={styles.viewerClose} aria-label="Close story" onClick={() => dialog.current?.close()}><X size={22} /></button></header>
        {story ? <>
          <div className={styles.progress} aria-label={`Story ${authorStories.findIndex(item => item.id === story.id) + 1} of ${authorStories.length}`}>{authorStories.map(item => <span key={item.id} data-active={item.id === story.id} />)}</div>
          <div className={styles.storyContent} onTouchStart={event => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY } }} onTouchEnd={event => {
            const start = touch.current; touch.current = null
            if (!start) return
            const dx = event.changedTouches[0].clientX - start.x, dy = event.changedTouches[0].clientY - start.y
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1)
          }}>
            <article className={styles.paper}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={story.photoUrl} alt={story.placeName} /><span className={styles.placeType}>{story.type === 'hotel' ? 'Stay' : story.type === 'food_drink' ? 'Eat & drink' : story.type === 'transport' ? 'Transport' : 'Experience'}</span><h3>{story.placeName}</h3><p>{story.destination}</p>{story.caption && <p className={styles.caption}>{story.caption}</p>}
            </article>
          </div>
          <div className={styles.viewerActions}>
            {story.tripHref && <Link href={story.tripHref} onClick={() => dialog.current?.close()}>View trip →</Link>}
            {story.authorId !== userId && <button type="button" onClick={() => setSaveOpen(true)} aria-haspopup="dialog"><span>{saved.includes(story.id) ? <Check size={18} /> : <Plus size={19} />}</span>Save to a trip</button>}
            {story.authorId === userId && <button type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Delete story</button>}
          </div>
          {confirmDelete && <div className={styles.deletePrompt}><p>Remove this story now?</p><button type="button" disabled={deleting} onClick={async () => {
            setDeleting(true); setError('')
            try {
              const result = await deleteStory(story.id)
              if (result.error) setError(result.error)
              else { const next = available[index + 1] ?? available[index - 1]; setRemoved(previous => [...previous, story.id]); setConfirmDelete(false); if (next) setSelected(next.id); else dialog.current?.close() }
            } catch { setError('Could not delete your story. Please try again.') } finally { setDeleting(false) }
          }}>{deleting ? 'Removing…' : 'Delete'}</button><button type="button" disabled={deleting} onClick={() => setConfirmDelete(false)}>Keep story</button></div>}
          {error && <p role="alert" className={styles.viewerError}>{error}</p>}
          <nav className={styles.storyNav} aria-label="Story navigation"><button type="button" disabled={index <= 0 || deleting} aria-label="Previous story" onClick={() => move(-1)}><ChevronLeft size={22} /></button><span>Swipe to explore</span><button type="button" disabled={index >= available.length - 1 || deleting} aria-label="Next story" onClick={() => move(1)}><ChevronRight size={22} /></button></nav>
        </> : <div className={styles.expired}><p>This polaroid is no longer available.</p><button type="button" onClick={() => dialog.current?.close()}>Back to feed</button></div>}
      </div>
    </dialog>
    {story && <SavePlaceToPlan key={story.id} storyId={story.id} placeName={story.placeName} open={saveOpen} onClose={() => setSaveOpen(false)} onSaved={() => setSaved(previous => [...previous, story.id])} />}
  </>
}
