import type { Metadata } from 'next'
import Link from 'next/link'
import { SUPPORT_EMAIL } from '@/lib/support'

export const metadata: Metadata = { title: 'Help — Postcard' }

// The App Store's Support URL: how to reach us, and answers to the common questions. Open to everyone, signed in or not.
const answers: { question: string; answer: React.ReactNode }[] = [
  { question: 'I forgot my password', answer: <p>On the sign-in screen, tap <strong>Forgot password?</strong> and we’ll email you a link to choose a new one. You can also <Link href="/forgot-password" className="underline">reset it here</Link>.</p> },
  { question: 'How do I report a trip, comment, message or person?', answer: <p>Tap <strong>Report</strong> on the trip, comment, message, snapshot or profile and choose a reason. We review every report, usually within a day. You can also email us.</p> },
  { question: 'How do I block someone?', answer: <p>Open their profile and tap <strong>Block</strong>. You won’t see each other’s trips, comments or snapshots, you’ll stop following each other, and they can’t message you. They aren’t told.</p> },
  { question: 'Who can see my trips?', answer: <p>Plans you’re working on are private: only you can see them. When you post a trip, it’s shared with the people you choose. A private profile limits your posts to people you approve.</p> },
  { question: 'How do I turn notifications on or off?', answer: <p>In the app, go to <strong>Profile → Settings</strong> and choose which notifications you get. You can also turn them off in your iPhone’s Settings → Notifications → Postcard.</p> },
  { question: 'How do I delete my account?', answer: <p>Go to <strong>Profile → Settings → Delete account</strong>. Your account and everything in it are removed right away, and this can’t be undone.</p> },
]

export default function SupportPage() {
  return <article className="mx-auto max-w-2xl px-4 py-8 text-ink">
    <h1 className="type-display">Help</h1>
    <p className="mt-5 text-base leading-relaxed">Questions, problems or ideas? Email us at <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-link underline">{SUPPORT_EMAIL}</a> and we’ll get back to you, usually within a day.</p>
    {answers.map(item => <section key={item.question} className="mt-7 text-base leading-relaxed">
      <h2 className="type-title mb-2">{item.question}</h2>
      {item.answer}
    </section>)}
    <p className="mt-10 text-sm text-muted"><Link href="/terms" className="underline">Terms of use</Link> · <Link href="/privacy" className="underline">Privacy Policy</Link></p>
  </article>
}
