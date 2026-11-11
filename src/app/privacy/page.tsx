import type { Metadata } from 'next'
import Link from 'next/link'
import { SUPPORT_EMAIL } from '@/lib/support'

export const metadata: Metadata = { title: 'Privacy Policy — Postcard' }

const UPDATED = 'November 11, 2026'

const sections: { title: string; body: React.ReactNode }[] = [
  { title: 'What we collect', body: <ul className="list-disc space-y-1 pl-5">
    <li><strong>Your account:</strong> your name, email address, and password (stored only as a secure hash). If you sign in with Google or Apple, we receive your name and email address from them. We do not receive your Google or Apple password, contacts, or any other account data.</li>
    <li><strong>What you share on Postcard:</strong> trips, places, ratings, notes, photos, comments, messages, stories, and saved lists.</li>
    <li><strong>People you connect with:</strong> who you follow and who follows you.</li>
    <li><strong>Planning chats:</strong> messages you send to the Plan with AI assistant and its replies.</li>
    <li><strong>Your device:</strong> if you turn on notifications in the iPhone app, a push token so we can send them.</li>
    <li><strong>How you use Postcard:</strong> which pages you open, how long you spend on them, and what you tap, along with your browser or device type. This is linked to your account when you’re signed in.</li>
  </ul> },
  { title: 'How we use it', body: <ul className="list-disc space-y-1 pl-5">
    <li>To run Postcard: show your trips to the people you choose, send notifications and messages, and keep you signed in.</li>
    <li>To suggest places and plans, using your trips and your friends’ trips.</li>
    <li>To understand which parts of Postcard people use and where they get stuck, so we can improve it.</li>
    <li>We do not sell your information and do not use it for advertising.</li>
  </ul> },
  { title: 'Who can see your trips', body: <p>Trips you post are visible according to the settings you choose. Private plans are visible only to you. A private profile limits your posts to people you approve.</p> },
  { title: 'Services we use', body: <>
    <p>We share only what each service needs to do its job:</p>
    <ul className="mt-2 list-disc space-y-1 pl-5">
      <li><strong>Vercel</strong> hosts the app and stores uploaded photos.</li>
      <li><strong>Neon</strong> hosts our database.</li>
      <li><strong>Google Maps and Places</strong> look up places and show maps and place photos.</li>
      <li><strong>Anthropic, OpenAI, and Google Gemini</strong> power AI features such as trip planning and importing trips from files. They receive the text you send to those features and relevant trip details.</li>
      <li><strong>Pexels</strong> provides stock cover photos.</li>
      <li><strong>PostHog</strong> measures how Postcard is used (pages opened, time spent, taps). It doesn’t use this for advertising.</li>
      <li><strong>Apple</strong> delivers push notifications; <strong>Google and Apple</strong> handle sign-in if you choose them.</li>
    </ul>
  </> },
  { title: 'Google Photos', body: <p>If you choose to add trip photos from Google Photos, Postcard asks Google for permission to see only the photos you pick in Google’s own photo picker. Postcard copies those photos into your trip, where they’re treated like any photo you upload, and never sees the rest of your library. Postcard doesn’t keep access to your Google account: the permission is used only while you’re picking, and isn’t stored. You can remove it any time at <a href="https://myaccount.google.com/permissions" className="underline">myaccount.google.com/permissions</a>. Postcard’s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="underline">Google API Services User Data Policy</a>, including the Limited Use requirements. Photos from Google aren’t used for advertising, aren’t sold, and aren’t used to train AI models.</p> },
  { title: 'AI assistants you connect', body: <p>If you connect an AI assistant such as Claude, ChatGPT or Muse to Postcard (see <Link href="/connector" className="font-semibold text-link underline">Postcard for AI assistants</Link>), it can, after you sign in and allow it, list and read your own trips and create or add places to your private plans. We share only those trips with it, in answer to the requests it makes; what it does with them is covered by that assistant’s own privacy policy. We don’t receive your conversations with the assistant. We keep a sign-in key for each connected assistant until you disconnect it in Settings (or it expires after 90 days), and nothing else about the assistant.</p> },
  { title: 'Keeping and deleting your data', body: <p>We keep your information while your account is open. You can delete your account and everything in it at any time in <strong>Settings → Delete account</strong>; it’s removed right away and can’t be undone. You can also email us at <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>.</p> },
  { title: 'Security', body: <p>Passwords are stored as secure hashes, and data is sent over encrypted connections.</p> },
  { title: 'Children', body: <p>Postcard is not intended for children under 13, and we do not knowingly collect their information.</p> },
  { title: 'Changes and contact', body: <p>If we change this policy, we will update the date above. Questions? Email <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>.</p> },
]

export default function PrivacyPage() {
  return <article className="mx-auto max-w-2xl px-4 py-8 text-ink">
    <h1 className="type-display">Privacy Policy</h1>
    <p className="mt-1 text-sm text-muted">Last updated {UPDATED}</p>
    <p className="mt-5 text-base leading-relaxed">Postcard is a place to plan trips and share the places worth going. This policy explains what we collect, why, and the choices you have.</p>
    {sections.map(section => <section key={section.title} className="mt-7 text-base leading-relaxed">
      <h2 className="type-title mb-2">{section.title}</h2>
      {section.body}
    </section>)}
  </article>
}
