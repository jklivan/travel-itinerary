'use client'

import { useEffect } from 'react'
import { isStaleDeployError, reloadForNewDeploy, reportClientError } from '@/lib/clientErrors'

// Replaces the root layout when it fails, so it can't rely on globals.css or fonts.
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    reportClientError('global-error', error, error.digest)
    if (isStaleDeployError(error)) reloadForNewDeploy()
  }, [error])
  return <html lang="en">
    <body style={{ margin: 0, minHeight: '100vh', background: '#f3eee5', color: '#2e4147', fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
      <title>Postcard</title>
      <div>
        <h1 style={{ fontSize: 22, margin: 0 }}>Something went wrong</h1>
        <p style={{ fontSize: 14, color: '#73786d' }}>Your saved trips are safe. Try again, or reload the page.</p>
        <button type="button" onClick={() => unstable_retry()} style={{ minHeight: 44, padding: '0 20px', borderRadius: 12, border: 0, background: '#2e4147', color: 'white', fontWeight: 600, marginRight: 8 }}>Try again</button>
        <button type="button" onClick={() => location.reload()} style={{ minHeight: 44, padding: '0 20px', borderRadius: 12, border: '1px solid #d7cebc', background: 'transparent', color: '#59694f', fontWeight: 600 }}>Reload</button>
      </div>
    </body>
  </html>
}
