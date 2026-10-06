import Link from 'next/link'
import Image from 'next/image'

// The home page for signed-out visitors: a full-screen harbour photo (public/brand/welcome-harbor.jpg), the Postcard stamp, Sign up and Log in.
// It covers the header and bottom bar; shared trip links still open for anyone.
export default function WelcomeScreen() {
  return <div className="fixed inset-0 z-[90] overflow-hidden bg-ink">
    <Image src="/brand/welcome-harbor.jpg" alt="" fill priority sizes="100vw" className="object-cover object-bottom" />
    {/* Light sky at the top for the stamp; darker toward the buttons. */}
    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(243,238,228,0.25)_0%,rgba(243,238,228,0)_45%,rgba(15,29,51,0)_70%,rgba(15,29,51,0.35)_100%)]" />
    <div className="relative flex h-full flex-col items-center px-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(3rem,calc(env(safe-area-inset-top)+1.25rem))]">
      {/* The stamp with the photo showing through it. */}
      <Image src="/brand/postcard-stamp-clear.png" alt="Postcard" width={512} height={512} priority className="size-[min(190px,46vw)]" />
      <p className="mt-3 text-center font-[family-name:var(--font-playfair)] text-sm font-semibold uppercase tracking-[0.32em] text-ink">Places worth<br />sharing</p>
      <div className="mt-auto w-full max-w-sm space-y-3">
        <Link href="/register" className="flex min-h-14 items-center justify-center rounded-full bg-ink text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-lg">Sign up</Link>
        <Link href="/login" className="flex min-h-14 items-center justify-center rounded-full border border-white/80 bg-black/20 text-sm font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm">Log in</Link>
      </div>
    </div>
  </div>
}
