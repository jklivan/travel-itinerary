import type { Metadata } from 'next'
import Link from 'next/link'
import { SUPPORT_EMAIL } from '@/lib/support'

export const metadata: Metadata = { title: 'Consumer Health Data Privacy Policy — Postcard' }

const UPDATED = 'November 13, 2026'

// Washington's My Health My Data Act (and similar laws in Nevada and Connecticut): what health information Postcard
// keeps, why, who receives it, and how to see, delete it or withdraw consent. Linked from the home page, the
// privacy policy, Settings and the chat's consent card (app/testplan/RememberConsent, lib/travelerMemory).
const sections: { title: string; body: React.ReactNode }[] = [
  { title: 'What health information we keep', body: <>
    <p>Postcard’s AI trip planner can remember health details you ask it to, so it can plan around them on every trip: for example a food allergy, a dietary need for a medical reason, a mobility need or a condition that affects what you can do (“my son is allergic to peanuts”, “I use a wheelchair”). These details can be about you or the people you travel with.</p>
    <p className="mt-2">We only keep a health detail after you ask the planner to remember it and then tap <strong>Save</strong> on the card that asks for your consent. We record when you agreed. If you mention a health detail without saving it, the planner uses it in that conversation only and doesn’t keep it for later chats.</p>
    <p className="mt-2">Your messages to the planner, which may include health details you choose to mention, are also stored as part of your chat history so you can come back to a conversation. You can delete your account, and with it your chats, at any time.</p>
  </> },
  { title: 'Why we keep it', body: <p>Only to plan your trips: to suggest places, restaurants and activities that work for you and the people you travel with. We don’t use health information for advertising, sell it, or use it for anything else.</p> },
  { title: 'Where it comes from', body: <p>Only from you, when you tell the planner. We don’t collect health information from anyone else or infer it from your trips, photos or location.</p> },
  { title: 'Who receives it', body: <>
    <p>We don’t sell or share health information with other companies or people. These service providers process it for us, only to run Postcard and under contracts that limit what they can do with it:</p>
    <ul className="mt-2 list-disc space-y-1 pl-5">
      <li><strong>Anthropic</strong>, our AI provider, receives it as part of your conversations with the planner, to write its answers.</li>
      <li><strong>Neon</strong> stores it in our database, and <strong>Vercel</strong> hosts the app.</li>
    </ul>
    <p className="mt-2">Health details are never shown on your profile, your posts or to other users.</p>
  </> },
  { title: 'Your rights and choices', body: <ul className="list-disc space-y-1 pl-5">
    <li><strong>See it:</strong> everything the planner remembers about you is listed in <strong>Settings → What Postcard knows about you</strong>, with the date you agreed to each health detail.</li>
    <li><strong>Delete it or withdraw consent:</strong> tap × next to any item there and it’s deleted straight away. Turning off <strong>Let the planner remember things about me</strong> deletes everything it remembered and stops it keeping anything new. <strong>Settings → Delete account</strong> deletes all your data, including your chats.</li>
    <li><strong>Ask us:</strong> email <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a> to confirm what health information we have, get a copy, have it deleted, or ask which service providers received it. We’ll answer within 45 days. If we turn down a request, you can appeal by replying to our answer, and we’ll respond within 45 days; if you’re not satisfied, you can contact your state attorney general.</li>
  </ul> },
  { title: 'Changes and contact', body: <p>If we change this policy, we’ll update the date above and ask for your consent again before using health information in a new way. Questions? Email <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>. See also our <Link href="/privacy" className="underline">Privacy Policy</Link>.</p> },
]

export default function HealthDataPolicyPage() {
  return <article className="mx-auto max-w-2xl px-4 py-8 text-ink">
    <h1 className="type-display">Consumer Health Data Privacy Policy</h1>
    <p className="mt-1 text-sm text-muted">Last updated {UPDATED}</p>
    <p className="mt-5 text-base leading-relaxed">This policy explains how Postcard (JJR Travel, Inc) handles consumer health data, as required by Washington’s My Health My Data Act and similar laws in other states.</p>
    {sections.map(section => <section key={section.title} className="mt-7 text-base leading-relaxed">
      <h2 className="type-title mb-2">{section.title}</h2>
      {section.body}
    </section>)}
  </article>
}
