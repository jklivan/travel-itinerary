// Sends a browser-side error to /api/client-error. Never throws: reporting must not cause a second failure.
export function reportClientError(kind: string, error: unknown, digest?: string) {
  try {
    const value = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error))
    const body = JSON.stringify({ kind, message: value.message, stack: value.stack, digest, url: location.pathname + location.search })
    if (!navigator.sendBeacon?.('/api/client-error', new Blob([body], { type: 'application/json' }))) {
      void fetch('/api/client-error', { method: 'POST', body, keepalive: true }).catch(() => {})
    }
  } catch {}
}

// Errors that mean this tab is running code from an older deploy than the server's.
export function isStaleDeployError(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /ChunkLoadError|Loading (CSS )?chunk \S+ failed|Failed to fetch dynamically imported module|Failed to find Server Action|Server Action .* was not found/i.test(message)
}

// Reloads the page once to pick up the current deploy. Returns false if we already tried recently,
// so a real bug can't cause a reload loop.
export function reloadForNewDeploy() {
  try {
    const last = Number(sessionStorage.getItem('stale-deploy-reload') ?? 0)
    if (Date.now() - last < 30000) return false
    sessionStorage.setItem('stale-deploy-reload', String(Date.now()))
  } catch { return false }
  location.reload()
  return true
}
