import Link from 'next/link'
import { Search, ChevronRight, MapPin, MessagesSquare, Users, Globe } from 'lucide-react'
import styles from './ExploreLanding.module.css'

const cards = [
  { href: '/explore?tag=day-trip', title: 'Day trips', description: 'Quick escapes nearby', position: '0% 0%', Icon: MapPin, color: '#979e87' },
  { href: '/explore/questions', title: 'Ask your friends', description: 'Get recommendations & travel advice', position: '100% 0%', Icon: MessagesSquare, color: '#ad9072' },
  { href: '/explore?view=tags', title: 'Search by trip type', description: 'Family trips, couples getaways, and more', position: '0% 100%', Icon: Users, color: '#7e919c' },
  { href: '/explore?view=destinations', title: 'Search by destination', description: 'Explore places around the world', position: '100% 100%', Icon: Globe, color: '#979e87' },
]

export default function ExploreLanding() {
  return <div className={styles.page}>
    <header className={styles.heading}>
      <p className={styles.eyebrow}>Explore</p>
      <h1>Where to next?</h1>
      <p className={styles.intro}>Find ideas, get inspired, and plan your next trip together.</p>
    </header>
    <form action="/explore" className={styles.search} role="search">
      <label className="sr-only" htmlFor="explore-search">Search destinations, trip types, or keywords</label>
      <button type="submit" aria-label="Search Explore"><Search size={22} /></button>
      <input id="explore-search" name="q" type="search" required placeholder="Search destinations, trip types, or keywords" />
    </form>
    <nav aria-label="Ways to explore" className={styles.grid}>
      {cards.map(card => <Link key={card.href} href={card.href} className={styles.card}>
        <span aria-hidden="true" className={styles.photo} style={{ backgroundPosition: card.position }} />
        <div className={styles.cardContent}>
        <span className={styles.badge} style={{ backgroundColor: card.color }} aria-hidden="true"><card.Icon size={23} strokeWidth={1.6} /></span>
        <h2>{card.title}</h2>
        <div className={styles.cardFooter}><p>{card.description}</p><span className={styles.arrow} aria-hidden="true"><ChevronRight size={20} /></span></div>
        </div>
      </Link>)}
    </nav>
  </div>
}
