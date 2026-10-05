'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, ChevronLeft, ChevronRight, MapPin, MessageCircle, Plus, Tag, Trash2, X, Pause, Play } from 'lucide-react'
import { activeStories, deleteStory, setStoryCategory } from '@/actions/stories'
import { groupStories, type StoryCard } from '@/lib/stories'
import StoryComposer from './StoryComposer'
import { sizedPhoto } from '@/lib/photoSizing'
import SavePlaceToPlan from './SavePlaceToPlan'
import UserAvatar from './UserAvatar'
import styles from './Stories.module.css'

const storyTypes = [['activity', 'Experience'], ['hotel', 'Stay'], ['food_drink', 'Eat & drink'], ['transport', 'Transport']] as const
const typeLabel = (type: string) => storyTypes.find(([value]) => value === type)?.[1] ?? 'Experience'

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
    <div className={styles.barHeading}><h2>SNAPSHOTS</h2></div>
    <div className={styles.tray}>
      {userId ? <button type="button" className={styles.addStory} onClick={() => { setMessage(''); setComposing(true) }}><span><Plus size={25} /></span>Your story</button> : <Link href="/login" className={styles.addStory}><span><Plus size={25} /></span>Your story</Link>}
      {groups.map(group => { const latest = group.items[0]; return <button key={group.authorId} type="button" className={styles.storyThumb} disabled={!!loading} aria-label={`View ${group.authorId === userId ? 'your' : latest.authorName + '’s'} stories, ${group.items.length} ${group.items.length === 1 ? 'story' : 'stories'}`} onClick={async () => {
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
        <img src={sizedPhoto(latest.photoUrl, 256)} alt="" /><i>{loading === group.authorId ? '…' : group.items.length > 1 ? group.items.length : ''}</i>
      </span><span className={styles.author}>{group.authorId === userId ? 'You' : latest.authorName}</span></button> })}
      {!groups.length && <p className={styles.trayHint}>A hotel you loved.<br />A meal to remember.<br />Share a snapshot.</p>}
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
  // Your own snapshots: a corrected category, shown right away (keyed by snapshot).
  const [changingType, setChangingType] = useState(false)
  const [savingType, setSavingType] = useState(false)
  const [types, setTypes] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saved, setSaved] = useState<string[]>([])
  const [error, setError] = useState('')
  const touch = useRef<{ x: number; y: number; time: number } | null>(null)
  const [holding, setHolding] = useState(false)
  const [paused, setPaused] = useState(false)
  const [loaded, setLoaded] = useState('')
  const available = stories.filter(story => Date.parse(story.expiresAt) > now && !removed.includes(story.id))
  const index = available.findIndex(story => story.id === selected)
  const story = available[index]
  const authorStories = story ? available.filter(item => item.authorId === story.authorId) : []
  // Start loading the next snapshot while this one is on screen.
  const upcoming = available[index + 1]?.photoUrl
  useEffect(() => { if (upcoming) new Image().src = sizedPhoto(upcoming, 1080) }, [upcoming])
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    const previous = document.body.style.overflow
    if (previous !== 'hidden') document.body.style.overflow = 'hidden'
    return () => { element?.close(); if (previous !== 'hidden') document.body.style.overflow = previous }
  }, [])
  function move(offset: number) {
    if (deleting || saveOpen || confirmDelete || changingType) return
    const next = available[index + offset]
    if (next) { setSelected(next.id); setConfirmDelete(false); setChangingType(false); setError('') }
    else if (offset > 0) dialog.current?.close()
  }
  const minutes = story ? Math.max(0, Math.floor((now - Date.parse(story.createdAt)) / 60000)) : 0
  const age = minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`

  return <>
    <dialog ref={dialog} className={styles.viewer} aria-labelledby={titleId} onClose={onClose} onKeyDown={event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
    }}>
      <div className={styles.viewerInner}>
        <header className={styles.viewerHeader}><div className={styles.viewerAuthor}>{story && <UserAvatar name={story.authorName} image={story.authorImage} size={34} />}<div><h2 id={titleId}>{story?.authorName ?? 'Story expired'}</h2><p>{story ? age : 'Stories disappear after 24 hours.'}</p></div></div><button type="button" autoFocus className={styles.viewerClose} aria-label="Close story" onClick={() => dialog.current?.close()}><X size={22} /></button></header>
        {story ? <>
          <StoryProgress key={story.id} stories={authorStories} selected={story.id} paused={paused || holding || saveOpen || confirmDelete || changingType || deleting || loaded !== story.id} onComplete={() => move(1)} />
          <div className={styles.storyContent} onContextMenu={event => event.preventDefault()} onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0) return
            touch.current = { x: event.clientX, y: event.clientY, time: performance.now() }
            event.currentTarget.setPointerCapture(event.pointerId)
            setHolding(true)
          }} onPointerUp={event => {
            const start = touch.current; touch.current = null; setHolding(false)
            if (!start) return
            const dx = event.clientX - start.x, dy = event.clientY - start.y
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1)
            else if (performance.now() - start.time < 250 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
              const bounds = event.currentTarget.getBoundingClientRect()
              move(event.clientX < bounds.left + bounds.width / 2 ? -1 : 1)
            }
          }} onPointerCancel={() => { touch.current = null; setHolding(false) }} onLostPointerCapture={() => { touch.current = null; setHolding(false) }}>
            {/* A tilted polaroid on cream paper, the place in serif, and the caption handwritten. */}
            <article className={styles.story}>
              <div className={`photo-polaroid ${styles.polaroid}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img key={story.id} src={sizedPhoto(story.photoUrl, 1080)} alt={story.placeName} draggable={false} onLoad={() => setLoaded(story.id)} onError={() => setLoaded(story.id)} />
              </div>
              <span className={styles.placeType}>{typeLabel(types[story.id] ?? story.type)}</span>
              <h3 className={styles.storyTitle}>{story.placeName}</h3>
              <p className={styles.storyPlace}><MapPin size={15} aria-hidden="true" />{story.destination}</p>
              {/* Always there (empty when no caption) so the buttons sit in the same spot on every snapshot. */}
              <p className={styles.storyCaption}>{story.caption}</p>
            </article>
          </div>
          <div className={styles.viewerActions}>
            {story.tripHref && <Link href={story.tripHref} className={styles.pillOutline} onClick={() => dialog.current?.close()}><ArrowRight size={17} />View trip</Link>}
            {(story.authorId !== userId || !story.hasTrip) && <button type="button" className={styles.pillDark} onClick={() => setSaveOpen(true)} aria-haspopup="dialog">{saved.includes(story.id) ? <Check size={17} /> : <Plus size={17} />}Save to a trip</button>}
            <span className={styles.actionIcons}>
              {userId && story.authorId !== userId && <Link href={`/messages/${story.authorId}`} aria-label={`Message ${story.authorName}`} onClick={() => dialog.current?.close()}><MessageCircle size={21} /></Link>}
              {story.authorId === userId && <button type="button" aria-label="Change category" aria-expanded={changingType} onClick={() => { setConfirmDelete(false); setChangingType(value => !value) }}><Tag size={19} /></button>}
              {story.authorId === userId && <button type="button" aria-label="Delete story" onClick={() => { setChangingType(false); setConfirmDelete(true) }}><Trash2 size={19} /></button>}
            </span>
          </div>
          {changingType && <div className={styles.deletePrompt}><p>What kind of place is {story.placeName}? It changes in your trip too.</p><div className="mt-2 flex flex-wrap gap-2">{storyTypes.map(([value, label]) => <button key={value} type="button" disabled={savingType} aria-pressed={(types[story.id] ?? story.type) === value} className="chip !no-underline" onClick={async () => {
            if ((types[story.id] ?? story.type) === value) { setChangingType(false); return }
            setSavingType(true); setError('')
            try {
              const result = await setStoryCategory(story.id, value)
              if (result.error) setError(result.error)
              else { setTypes(current => ({ ...current, ...Object.fromEntries((result.ids ?? [story.id]).map(id => [id, value])) })); setChangingType(false) }
            } catch { setError('Could not change the category. Please try again.') } finally { setSavingType(false) }
          }}>{label}</button>)}</div></div>}
          {confirmDelete && <div className={styles.deletePrompt}><p>{story.removesTripPhoto ? `Remove this story now? Its photo will also come off ${story.placeName} in your trip.` : 'Remove this story now?'}</p><button type="button" disabled={deleting} onClick={async () => {
            setDeleting(true); setError('')
            try {
              const result = await deleteStory(story.id)
              if (result.error) setError(result.error)
              else { const next = available[index + 1] ?? available[index - 1]; setRemoved(previous => [...previous, story.id]); setConfirmDelete(false); if (next) setSelected(next.id); else dialog.current?.close() }
            } catch { setError('Could not delete your story. Please try again.') } finally { setDeleting(false) }
          }}>{deleting ? 'Removing…' : 'Delete'}</button><button type="button" disabled={deleting} onClick={() => setConfirmDelete(false)}>Keep story</button></div>}
          {error && <p role="alert" className={styles.viewerError}>{error}</p>}
          {/* Tap the left or right of the snapshot (or swipe) to move; hold to pause. These stay for keyboards and screen readers. */}
          <nav className={`${styles.storyNav} sr-only`} aria-label="Story navigation"><button type="button" disabled={index <= 0 || deleting || saveOpen || confirmDelete} aria-label="Previous story" onClick={() => move(-1)}><ChevronLeft size={22} /></button><button type="button" className={styles.playback} aria-label={paused ? 'Resume stories' : 'Pause stories'} onClick={() => setPaused(value => !value)}>{paused ? <Play size={18} /> : <Pause size={18} />}</button><button type="button" disabled={deleting || saveOpen || confirmDelete} aria-label="Next story" onClick={() => move(1)}><ChevronRight size={22} /></button></nav>
        </> : <div className={styles.expired}><p>This polaroid is no longer available.</p><button type="button" onClick={() => dialog.current?.close()}>Back to feed</button></div>}
      </div>
    </dialog>
    {story && <SavePlaceToPlan key={story.id} storyId={story.id} placeName={story.placeName} open={saveOpen} onClose={() => setSaveOpen(false)} onSaved={() => setSaved(previous => [...previous, story.id])} />}
  </>
}

function StoryProgress({ stories, selected, paused, onComplete }: { stories: StoryCard[]; selected: string; paused: boolean; onComplete: () => void }) {
  const [progress, setProgress] = useState(0)
  const [hidden, setHidden] = useState(false)
  const elapsed = useRef(0)
  const complete = useRef(onComplete)
  useEffect(() => { complete.current = onComplete }, [onComplete])
  useEffect(() => {
    const update = () => setHidden(document.hidden)
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  useEffect(() => {
    if (paused || hidden) return
    let previous = performance.now()
    let frame = 0
    function tick(now: number) {
      if (document.hidden) return
      elapsed.current += now - previous
      previous = now
      setProgress(Math.min(1, elapsed.current / 6000))
      if (elapsed.current >= 6000) complete.current()
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paused, hidden])
  const current = stories.findIndex(item => item.id === selected)
  return <div className={styles.progress} aria-label={`Story ${current + 1} of ${stories.length}`}>{stories.map((item, index) => <span key={item.id}><i style={{ transform: `scaleX(${index < current ? 1 : index === current ? progress : 0})` }} /></span>)}</div>
}
