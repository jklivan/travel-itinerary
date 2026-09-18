import Link from 'next/link'

const tabs = [
  { id: 'all', label: 'ALL' },
  { id: 'friends', label: 'FRIENDS' },
  { id: 'expert', label: 'EXPERT RECS' },
] as const

export default function FeedTabs({ active, search }: { active: string; search?: string }) {
  return <nav aria-label="Feed recommendations" className="flex items-center gap-1.5 overflow-x-auto">
    {tabs.map(tab => <Link key={tab.id} href={`/?feed=${tab.id}${search ? `&search=${encodeURIComponent(search)}` : ''}`} aria-current={active === tab.id ? 'page' : undefined}
      className={`shrink-0 rounded-full px-3 py-2 text-[9px] font-semibold tracking-[0.16em] transition-colors ${active === tab.id ? 'bg-[#355650] text-white' : 'text-[#73786d] hover:bg-[#e6ece5]'}`}>
      {tab.label}
    </Link>)}
  </nav>
}
