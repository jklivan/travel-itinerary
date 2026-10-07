import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy — Postcard' }

const CONTACT_EMAIL = 'jklivan@gmail.com'
const UPDATED = 'September 30, 2026'

const sections: { title: string; body: React.ReactNode }[] = [
  { title: 'What we collect', body: <ul className="list-disc space-y-1 pl-5">
    <li><strong>Your account:</strong> your name, email address, and password (stored only as a secure hash). If you sign in with Google or Apple, we receive your name and email address from them. We do not receive your Google or Apple password, contacts, or any other account data.</li>
    <li><strong>What you share on Postcard:</strong> trips, places, ratings, notes, photos, comments, messages, stories, and saved lists.</li>
    <li><strong>People you connect with:</strong> who you follow and who follows you.</li>
    <li><strong>Planning chats:</strong> messages you send to the Plan with AI assistant and its replies.</li>
    <li><strong>Your device:</strong> if you turn on notifications in the iPhone app, a push token so we can send them.</li>
  </ul> },
  { title: 'How we use it', body: <ul className="list-disc space-y-1 pl-5">
    <li>To run Postcard: show your trips to the people you choose, send notifications and messages, and keep you signed in.</li>
    <li>To suggest places and plans, using your trips and your friends’ trips.</li>
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
      <li><strong>Apple</strong> delivers push notifications; <strong>Google and Apple</strong> handle sign-in if you choose them.</li>
    </ul>
  </> },
  { title: 'Keeping and deleting your data', body: <p>We keep your information while your account is open. To delete your account and everything in it, email us at <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a> from the address on your account and we will delete it within 30 days. You can delete individual trips, places, and photos at any time in the app.</p> },
  { title: 'Security', body: <p>Passwords are stored as secure hashes, and data is sent over encrypted connections.</p> },
  { title: 'Children', body: <p>Postcard is not intended for children under 13, and we do not knowingly collect their information.</p> },
  { title: 'Changes and contact', body: <p>If we change this policy, we will update the date above. Questions? Email <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.</p> },
]

export default function PrivacyPage() {
  return <article className="mx-auto max-w-2xl px-4 py-8 text-ink">
    <h1 className="font-[family-name:var(--font-playfair)] text-display">Privacy Policy</h1>
    <p className="mt-1 text-sm text-muted">Last updated {UPDATED}</p>
    <p className="mt-5 text-base leading-relaxed">Postcard is a place to plan trips and share the places worth going. This policy explains what we collect, why, and the choices you have.</p>
    {sections.map(section => <section key={section.title} className="mt-7 text-base leading-relaxed">
      <h2 className="mb-2 font-[family-name:var(--font-playfair)] text-title text-link">{section.title}</h2>
      {section.body}
    </section>)}
  </article>
}
