export function internalPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return null
  const url = new URL(value, 'https://local.invalid')
  return url.origin === 'https://local.invalid' ? url.pathname + url.search + url.hash : null
}

export function itineraryId(path: string): string | null {
  return path.split(/[?#]/)[0].match(/^\/itinerary\/([a-zA-Z0-9_-]+)(?:\/edit)?\/?$/)?.[1] ?? null
}

export function rememberTripReturn(from: string, to: string, storage: Pick<Storage, 'setItem'>) {
  const source = internalPath(from)
  const target = internalPath(to)
  const id = target && itineraryId(target)
  // Switching trip tabs, entering edit, and returning after saving must keep the origin.
  if (source && id && itineraryId(source) !== id) {
    storage.setItem(`trip-return:${id}`, source)
  }
}

export function tripReturnPath(id: string, fallback: string): string {
  try {
    const saved = internalPath(sessionStorage.getItem(`trip-return:${id}`))
    if (saved && itineraryId(saved) !== id) return saved
  } catch { /* Storage may be unavailable in a private browsing session. */ }
  return internalPath(fallback) ?? '/'
}
