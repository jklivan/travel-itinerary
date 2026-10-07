'use client'

import { useEffect } from 'react'
import { isStaleDeployError, reloadForNewDeploy, reportClientError } from '@/lib/clientErrors'

// Without this, an uncaught render error leaves users on a blank page.
export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    reportClientError('error-boundary', error, error.digest)
    if (isStaleDeployError(error)) reloadForNewDeploy()
  }, [error])
  return <div className="mx-auto max-w-md px-6 py-16 text-center text-ink">
    <h1 className="font-[family-name:var(--font-playfair)] text-title">Something went wrong</h1>
    <p className="mt-2 text-sm text-muted">Your saved trips are safe. Try again, or reload the page.</p>
    <div className="mt-6 flex justify-center gap-3">
      <button type="button" onClick={() => unstable_retry()} className="btn btn-primary">Try again</button>
      <button type="button" onClick={() => location.reload()} className="btn btn-outline">Reload</button>
    </div>
  </div>
}
