import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Terms of Use — Postcard' }

const CONTACT_EMAIL = 'jklivan@gmail.com'
const UPDATED = 'October 13, 2026'

const sections: { title: string; body: React.ReactNode }[] = [
  { title: 'Using Postcard', body: <p>Postcard lets you plan trips and share the places worth going with the people you follow. By creating an account or using Postcard, you agree to these terms. You must be at least 13 years old.</p> },
  { title: 'What you post', body: <>
    <p>You own the trips, photos, notes, comments and messages you post, and you’re responsible for them. By posting, you let us show them to the people you share them with, as the app does.</p>
    <p className="mt-2"><strong>There is no tolerance for objectionable content or abusive users.</strong> Don’t post anything that is illegal, hateful, harassing, sexually explicit, violent, spam, or that infringes someone else’s rights, and don’t impersonate anyone.</p>
  </> },
  { title: 'Reporting and blocking', body: <p>You can report any trip, comment, message, snapshot or account, and block anyone. We review reports within 24 hours, remove content that breaks these terms, and remove accounts that do so.</p> },
  { title: 'Your account', body: <p>Keep your password safe. You can delete your account at any time in <strong>Settings → Delete account</strong>. We may suspend or remove accounts that break these terms.</p> },
  { title: 'Recommendations and prices', body: <p>Places, AI suggestions and hotel prices are for planning and can be out of date. Postcard doesn’t book anything; check details with the hotel, restaurant or booking site before you travel.</p> },
  { title: 'Changes and contact', body: <p>If we change these terms, we’ll update the date above. Questions or concerns? Email <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>. See also our <Link href="/privacy" className="underline">Privacy Policy</Link>.</p> },
]

export default function TermsPage() {
  return <article className="mx-auto max-w-2xl px-4 py-8 text-ink">
    <h1 className="type-display">Terms of Use</h1>
    <p className="mt-1 text-sm text-muted">Last updated {UPDATED}</p>
    {sections.map(section => <section key={section.title} className="mt-7 text-base leading-relaxed">
      <h2 className="type-title mb-2">{section.title}</h2>
      {section.body}
    </section>)}
  </article>
}
