import Link from 'next/link'
import Image from 'next/image'
import PostcardLogo from '@/components/PostcardLogo'

// The home page for signed-out visitors: a full-screen coast photo, the Postcard stamp, Sign up and Log in.
// It covers the header and bottom bar; shared trip links still open for anyone.
export default function WelcomeScreen() {
  return <div className="fixed inset-0 z-[90] overflow-hidden bg-ink">
    <Image src="https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80" alt="" fill priority sizes="100vw" className="object-cover" />
    {/* Light sky at the top for the stamp; darker toward the buttons. */}
    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(243,238,228,0.88)_0%,rgba(243,238,228,0.6)_40%,rgba(243,238,228,0)_58%,rgba(15,29,51,0.5)_100%)]" />
    <div className="relative flex h-full flex-col items-center px-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(4.5rem,calc(env(safe-area-inset-top)+3rem))]">
      <PostcardLogo size={190} alt="Postcard" priority className="size-[min(190px,48vw)]" />
      <p className="mt-6 text-center font-[family-name:var(--font-playfair)] text-sm font-semibold uppercase tracking-[0.32em] text-ink">Places worth<br />sharing</p>
      <div className="mt-auto w-full max-w-sm space-y-3">
        <Link href="/register" className="flex min-h-14 items-center justify-center rounded-full bg-ink text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-lg">Sign up</Link>
        <Link href="/login" className="flex min-h-14 items-center justify-center rounded-full border border-white/80 bg-black/20 text-sm font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm">Log in</Link>
      </div>
    </div>
  </div>
}
