import Link from 'next/link'
import { ArrowRight, ChevronRight } from 'lucide-react'
import styles from './ExploreLanding.module.css'

const cards = [
  { href: '/explore?tag=day-trip', title: 'Day trips', description: 'Quick escapes nearby', position: '0% 0%' },
  { href: '/explore/questions', title: 'Ask your friends', description: 'Get recommendations & travel advice', position: '100% 0%' },
  { href: '/explore?view=destinations', title: 'Search by destination', description: 'Browse places around the world', position: '0% 100%' },
  { href: '/explore?view=tags', title: 'Search by trip type', description: 'Family trips, couples getaways, and more', position: '100% 100%' },
]

export default function ExploreLanding() {
  return <div className={styles.page}>
    <header className={styles.heading}>
      <p className={styles.eyebrow}>Explore</p>
      <h1>Where to next?</h1>
      <p className={styles.intro}>Find ideas, get inspired, and plan<br className={styles.lineBreak} /> your next trip together.</p>
    </header>
    <form action="/explore" className={styles.search} role="search">
      <label className="sr-only" htmlFor="explore-search">Search destinations, trip types, or keywords</label>
      <input id="explore-search" name="q" type="search" required placeholder="Search destinations, trip types, or keywords" />
      <button type="submit" aria-label="Search Explore"><ArrowRight size={21} /></button>
    </form>
    <nav aria-label="Ways to explore" className={styles.grid}>
      {cards.map(card => <Link key={card.href} href={card.href} className={styles.card}>
        <span aria-hidden="true" className={styles.illustration} style={{ backgroundPosition: card.position }} />
        <h2>{card.title}</h2>
        <div className={styles.cardFooter}><p>{card.description}</p><span className={styles.arrow} aria-hidden="true"><ChevronRight size={20} /></span></div>
      </Link>)}
    </nav>
  </div>
}
