import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import AssistantConnect from '@/components/AssistantConnect'
import { returnPath } from '@/lib/returnPath'

// Settings → Connect an AI assistant (also the intro's last slide): the connector address to give Muse, ChatGPT or
// Claude. From the intro, Continue goes back to signing up.
export default async function AssistantSettingsPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!(await auth())?.user?.id) redirect('/login?callbackUrl=%2Fsettings%2Fassistant')
  const next = returnPath((await searchParams).next)
  return <div className="page-wrap">
    <header className="page-header">
      <h1 className="page-title">Connect an AI assistant</h1>
      <p className="page-subtitle">Let Muse, ChatGPT or Claude add trips to Postcard for you.</p>
    </header>
    <AssistantConnect />
    {next ? <Link href={next} className="btn btn-primary mt-6 w-full">Continue</Link> : <Link href="/settings" className="mt-6 inline-block text-sm text-link underline">← Settings</Link>}
  </div>
}
