import type { Metadata } from 'next'
import Link from 'next/link'
import { SUPPORT_EMAIL } from '@/lib/support'

export const metadata: Metadata = { title: 'About Postcard', description: 'Postcard is a social travel app: share the trips you’ve taken, see where your friends have been, and plan your next trip from their favourite places.' }

// What Postcard is and does, for anyone (signed in or not): linked from the signed-out home page, and the app home
// page Google's OAuth review checks (it has to describe the app and how it uses Google data without a sign-in).
const features: { title: string; text: string }[] = [
  { title: 'Share the trips you’ve taken', text: 'Add the hotels, restaurants and things you did, with your photos, star ratings and notes, then post the trip for your friends to see.' },
  { title: 'See where your friends have been', text: 'Your feed shows the trips your friends post. Open any trip to see every place they stayed, ate and explored, day by day.' },
  { title: 'Plan your next trip', text: 'Search destinations on Explore, save places you love, and plan a trip with Postcard’s AI, which starts from what your friends loved.' },
  { title: 'Bring in trips you’ve already taken', text: 'Import an itinerary, booking emails, a PDF or a screenshot, and Postcard turns it into a trip.' },
]

export default function AboutPage() {
  return <article className="mx-auto max-w-2xl px-4 py-8 text-ink">
    <h1 className="type-display">About Postcard</h1>
    <p className="mt-5 text-base leading-relaxed">Postcard is a social travel app for sharing the places worth going. Post the trips you’ve taken, see where your friends have been, and plan your next trip from the places the people you trust actually loved. It’s free, on the web at postcardtravel.app and on iPhone.</p>

    <section className="mt-8 text-base leading-relaxed">
      <h2 className="type-title mb-2">What you can do</h2>
      <ul className="space-y-3">{features.map(feature => <li key={feature.title}><strong>{feature.title}</strong><br />{feature.text}</li>)}</ul>
    </section>

    <section className="mt-8 text-base leading-relaxed">
      <h2 className="type-title mb-2">How Postcard uses Google</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li><strong>Sign in with Google</strong> (optional): Postcard gets your name, email address and profile picture to create your account.</li>
        <li><strong>Add photos from Google Photos</strong> (optional): when you add photos to a trip, you can pick them in Google’s own photo picker. Postcard sees only the photos you pick, copies them into that trip, and never sees the rest of your library. They aren’t used for advertising, sold, or used to train AI models.</li>
      </ul>
      <p className="mt-3">Postcard’s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="font-semibold text-link underline">Google API Services User Data Policy</a>, including the Limited Use requirements. Details are in our <Link href="/privacy" className="font-semibold text-link underline">Privacy Policy</Link>.</p>
    </section>

    <section className="mt-8 text-base leading-relaxed">
      <h2 className="type-title mb-2">Get started</h2>
      <div className="flex flex-wrap gap-3"><Link href="/register" className="btn btn-primary">Sign up</Link><Link href="/login" className="btn btn-outline">Log in</Link></div>
    </section>

    <footer className="mt-10 border-t border-line-soft pt-4 text-sm text-muted">
      Postcard is made by JJR Travel, Inc. · <Link href="/privacy" className="underline">Privacy Policy</Link> · <Link href="/terms" className="underline">Terms of Service</Link> · <Link href="/support" className="underline">Support</Link> · <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>
    </footer>
  </article>
}
