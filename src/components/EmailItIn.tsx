import Link from 'next/link'
import { Mail } from 'lucide-react'
import CopyButton from '@/components/ui/CopyButton'

// The import panels' other way in: forward the itinerary or confirmations to your own Postcard address (it was only
// in Settings and Tips, hard to find once you're past the intro). address: null until they've made one.
export default function EmailItIn({ address, back }: { address: string | null; back: string }) {
  return <div className="border-t border-line-soft pt-4 text-sm">
    <p className="flex items-center gap-2 font-semibold text-ink"><Mail size={16} />Or email it in</p>
    {address ? <>
      <p className="mt-1 text-muted">Forward the confirmation, itinerary or notes to your Postcard address. The places go into the trip they belong to, or a new one.</p>
      <div className="panel-inset mt-2 flex items-center gap-2 p-3"><span className="min-w-0 flex-1 select-all break-all text-ink">{address}</span><CopyButton text={address} label="Copy your Postcard address" /></div>
    </> : <p className="mt-1 text-muted">Get your own Postcard address, then forward confirmations or itineraries to it. <Link href={`/settings/email?next=${encodeURIComponent(back)}`} className="font-semibold text-link underline">Get my address</Link></p>}
  </div>
}
