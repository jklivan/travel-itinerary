import type { Metadata } from 'next'
import Link from 'next/link'
import { SUPPORT_EMAIL } from '@/lib/support'

export const metadata: Metadata = { title: 'Postcard connector for AI assistants — Postcard', description: 'Connect Claude, ChatGPT or Muse to your Postcard trips.' }

const CONNECTOR_URL = 'https://www.postcardtravel.app/api/mcp'

// The public documentation for the Postcard connector (an MCP server at /api/mcp), linked from directory listings
// (Claude, Muse) and from Settings → Connect an AI assistant. Open to everyone, signed in or not.
const tools: { name: string; title: string; text: string }[] = [
  { name: 'list_trips', title: 'List my trips', text: 'Your trips, newest first: private plans you’re working on and trips you’ve posted, with dates, destinations and how many places each has. Read-only.' },
  { name: 'get_trip', title: 'Read a trip', text: 'Every place in one of your trips (hotels, restaurants, things to do, transport), by destination, with its day, date and time, your notes and rating. Read-only.' },
  { name: 'import_trip', title: 'Import a trip', text: 'Creates a new private plan from a written trip summary in any format (notes, an itinerary, booking confirmations). Postcard finds each place and files it under its town.' },
  { name: 'add_places', title: 'Add places to a plan', text: 'Adds places to one of your private plans, with the day, notes and your rating when you give them. It never changes posted trips.' },
]

const prompts = [
  'Add my last five trips to Postcard.',
  'Import this itinerary into Postcard as a new trip: [paste it]',
  'What did I love in Lisbon? Check my Postcard trips.',
  'Add these restaurants to my Postcard plan for Tokyo, on day 2.',
]

export default function ConnectorPage() {
  return <article className="mx-auto max-w-2xl px-4 py-8 text-ink">
    <h1 className="type-display">Postcard for AI assistants</h1>
    <p className="mt-5 text-base leading-relaxed">The Postcard connector lets your AI assistant (Claude, ChatGPT, Muse and others that support connectors) read your Postcard trips and add new ones for you, so you don’t have to type them in.</p>

    <section className="mt-8 text-base leading-relaxed">
      <h2 className="type-title mb-2">Set it up</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>You need a Postcard account. <Link href="/register" className="font-semibold text-link underline">Sign up</Link> if you don’t have one.</li>
        <li>In your assistant, add a custom connector (Claude: <strong>Settings → Connectors → Add custom connector</strong>; ChatGPT and Muse: their Connectors or Apps settings) with this address:
          <span className="panel-inset mt-2 block select-all break-all p-3 text-sm">{CONNECTOR_URL}</span></li>
        <li>Sign in to Postcard when it asks, and tap <strong>Allow</strong>.</li>
      </ol>
      <p className="mt-3">Or simply ask your assistant to add the address as a connector.</p>
    </section>

    <section className="mt-8 text-base leading-relaxed">
      <h2 className="type-title mb-2">What it can do</h2>
      <ul className="space-y-3">{tools.map(tool => <li key={tool.name}><strong>{tool.title}</strong> <span className="text-sm text-muted">({tool.name})</span><br />{tool.text}</li>)}</ul>
      <p className="mt-3">It can’t delete anything, change trips you’ve posted, post for you, or see other people’s private plans.</p>
    </section>

    <section className="mt-8 text-base leading-relaxed">
      <h2 className="type-title mb-2">Things to try</h2>
      <ul className="list-disc space-y-1 pl-5">{prompts.map(prompt => <li key={prompt}>“{prompt}”</li>)}</ul>
    </section>

    <section className="mt-8 text-base leading-relaxed">
      <h2 className="type-title mb-2">Privacy and disconnecting</h2>
      <p>The assistant only gets what you allow when you sign in: your own trips, to read them and add places to private plans. Trips it creates stay private until you post them. Postcard doesn’t receive your conversations with the assistant, only the requests it sends to the connector. To disconnect, go to <strong>Profile → Settings</strong>, find it under <strong>Connected assistants</strong> and tap <strong>Disconnect</strong>, or remove it in your assistant’s settings. See our <Link href="/privacy" className="font-semibold text-link underline">Privacy Policy</Link> for details.</p>
    </section>

    <section className="mt-8 text-base leading-relaxed">
      <h2 className="type-title mb-2">Help</h2>
      <p>Email <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-link underline">{SUPPORT_EMAIL}</a>. Your assistant can also send trips to your own Postcard email address: see <Link href="/settings/email" className="font-semibold text-link underline">Email trips to Postcard</Link>.</p>
    </section>
  </article>
}
