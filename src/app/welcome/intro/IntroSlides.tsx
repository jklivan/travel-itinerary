'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronRight, FileText, Mail, Sparkles } from 'lucide-react'
import styles from './intro.module.css'

// Each slide: a heading, a line about it, and a real screenshot of that page (public/brand/intro, taken at phone size
// from the live app, so the fonts match the app exactly). The trip slide plays a short screen recording instead:
// opening a friend's trip, scrolling its places, then its day-by-day itinerary.
const SLIDES: { title: string; text: string; image?: string; video?: string; tips?: boolean }[] = [
  { title: 'Discover real travel inspiration.', text: 'Browse the Feed to see where friends have been, get ideas, and explore places worth adding to your list.', image: '/brand/intro/feed.jpg' },
  { title: 'Look inside any trip.', text: 'See every place they stayed, ate and explored, then follow their trip day by day.', image: '/brand/intro/trip-poster.jpg', video: '/brand/intro/trip.mp4' },
  { title: 'Explore ideas for your next trip.', text: 'Search destinations, browse trip types, and find inspiration for your next adventure.', image: '/brand/intro/explore.jpg' },
  { title: 'Plan with Postcard.', text: 'Get personalized ideas, build an itinerary, and organize your plans with the help of Postcard.', image: '/brand/intro/plan-2.jpg' },
  { title: 'Create and share your own trips.', text: 'Add the places you went (hotels, restaurants and activities), then post it to share with friends.', image: '/brand/intro/post-2.jpg' },
  { title: 'Bring in trips you’ve already taken.', text: 'Have an itinerary or notes? Import a PDF, doc, email or screenshot and Postcard turns it into a trip.', image: '/brand/intro/import.jpg' },
  { title: 'Stay organized.', text: 'See your posted trips, plan your upcoming adventures, and save places you love, all in one place.', image: '/brand/intro/trips.jpg' },
  // Last: ways to bring trips in, each opening its page (and Continue there comes back to signing up).
  { title: 'Tips for new users.', text: 'Quick ways to get the most out of Postcard.', tips: true },
]

// Full screen over the app's header and bottom bar. Swipe between slides (they snap), or tap Next; Skip and the
// last slide's button go on to `next`.
export default function IntroSlides({ next }: { next: string }) {
  const router = useRouter()
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const last = index === SLIDES.length - 1
  const go = (to: number) => track.current?.scrollTo({ left: to * track.current.clientWidth, behavior: 'smooth' })

  return <div className="fixed inset-0 z-[60] flex flex-col bg-paper pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] text-ink">
    <div className="flex justify-end px-5 pt-3">
      <Link href={next} className="py-2 text-base font-medium text-ink">Skip</Link>
    </div>
    <div ref={track} onScroll={event => setIndex(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}
      className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {SLIDES.map((slide, i) => <section key={slide.title} aria-roledescription="slide" aria-label={`${i + 1} of ${SLIDES.length}`} aria-hidden={i !== index}
        className="flex w-full shrink-0 snap-center flex-col items-center px-6">
        <h1 className={`type-display ${styles.headline} max-w-sm text-center`}>{slide.title}</h1>
        <p className="mt-3 max-w-sm text-center text-base leading-snug text-link">{slide.text}</p>
        {slide.tips ? <TipsAndTricks next={next} /> : <div className={`${styles.stage} mt-5 flex min-h-0 w-full flex-1 items-start justify-center`}>
          <div className={`${styles.phone} shadow-pop`}>
            <div className={styles.screen}>
              {slide.video
                ? <SlideVideo src={slide.video} poster={slide.image!} active={i === index} />
                : <Image src={slide.image!} alt="" fill sizes="300px" priority={i < 2} className="object-cover object-top" />}
            </div>
          </div>
        </div>}
      </section>)}
    </div>
    <div aria-hidden="true" className="flex justify-center gap-2 pt-4">
      {SLIDES.map((slide, i) => <span key={slide.title} className={`${styles.dot} ${i === index ? styles.dotActive : ''}`} />)}
    </div>
    <div className="flex justify-center px-6 pt-4">
      <button type="button" onClick={() => last ? router.push(next) : go(index + 1)} className="btn btn-primary w-full max-w-sm text-base">
        {last ? 'Get started' : 'Next'} <ArrowRight size={18} />
      </button>
    </div>
  </div>
}

// A silent screen recording that starts from the beginning each time its slide comes into view, and pauses when it
// leaves.
function SlideVideo({ src, poster, active }: { src: string; poster: string; active: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const element = video.current
    if (!element) return
    if (active) { element.currentTime = 0; void element.play().catch(() => {}) } else element.pause()
  }, [active])
  return <video ref={video} src={src} poster={poster} muted loop playsInline preload="auto" aria-hidden="true" className="absolute inset-0 size-full object-cover object-top" />
}

// The last slide: three ways to bring trips in (each opens its page; Continue there comes back here to sign-up's next
// step), and a few more tips.
function TipsAndTricks({ next }: { next: string }) {
  const back = encodeURIComponent(next)
  const tiles = [
    { href: `/settings/assistant?next=${back}`, Icon: Sparkles, title: 'Connect an AI agent', text: 'Link an AI trip planner (like Muse, ChatGPT or Claude) to create and import itineraries for you.' },
    { href: '/plan?from=post&import=1', Icon: FileText, title: 'Import a trip', text: 'Upload a PDF, notes or an itinerary and we’ll turn it into a shareable trip.' },
    { href: `/settings/email?next=${back}`, Icon: Mail, title: 'Email it to Postcard', text: 'Forward itineraries, confirmations or notes to your own Postcard address and we’ll make a trip for you.' },
  ]
  return <div className="mt-5 min-h-0 w-full max-w-sm flex-1 space-y-3 overflow-y-auto pb-2">
    {tiles.map(({ href, Icon, title, text }) => <Link key={title} href={href} className="panel-hint flex items-center gap-4 p-4 text-left text-ink transition-colors hover:bg-mist-strong">
      <Icon size={28} strokeWidth={1.5} className="shrink-0 text-link" />
      <span className="min-w-0 flex-1"><span className="block text-base font-semibold">{title}</span><span className="mt-0.5 block text-sm leading-snug text-muted">{text}</span></span>
      <ChevronRight size={18} className="shrink-0 text-link" />
    </Link>)}
    <div className="rounded-2xl bg-cream p-4 text-left">
      <p className="flex items-center gap-2 text-base font-semibold text-ink"><Sparkles size={18} className="text-link" />More tips</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
        <li>Post a full trip or just your favorite spots</li>
        <li>Edit or reorder your itinerary anytime</li>
        <li>Keep trips private or share with friends</li>
        <li>Save places to a folder for later</li>
      </ul>
    </div>
  </div>
}
