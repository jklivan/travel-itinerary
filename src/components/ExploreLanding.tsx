import Link from 'next/link'
import { Search } from 'lucide-react'
import PolaroidTile from '@/components/ui/PolaroidTile'
import styles from './ExploreLanding.module.css'

const cards = [
  { href: '/explore?tag=day-trip', title: 'Day Trips', position: '0% 0%' },
  { href: '/explore?view=tags', title: 'Trip Types', position: '0% 100%' },
  { href: '/explore?view=destinations', title: 'Destinations', position: '100% 100%' },
  { href: '/explore/questions', title: 'Ask Your Friends', position: '100% 0%' },
]

export default function ExploreLanding() {
  return <div className={`page-wrap ${styles.page}`}>
    <header className="page-header">
      <h1 className="page-title">Where to next?</h1>
      <p className="page-subtitle">Find ideas, get inspired, and plan your next trip together.</p>
    </header>
    <form action="/explore" className={styles.search} role="search">
      <label className="sr-only" htmlFor="explore-search">Search destinations, trip types, or keywords</label>
      <button type="submit" aria-label="Search Explore"><Search size={22} /></button>
      <input id="explore-search" name="q" type="search" required placeholder="Search destinations, trip types, or keywords" />
    </form>
    <nav aria-label="Ways to explore" className={styles.grid}>
      {/* Same polaroid tiles as Search by trip type and the new-plan choices, with an arrow. */}
      {cards.map((card, index) => <Link key={card.href} href={card.href} className={styles.card}>
        <PolaroidTile photo="/explore-photos.webp" photoPosition={card.position} photoSize="200% 200%" label={card.title} index={index} trailing="arrow" size="lg" labelStyle="serif" />
      </Link>)}
    </nav>
  </div>
}
