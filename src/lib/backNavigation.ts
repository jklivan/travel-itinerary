const RETURN_KEY = '__milesAwayPrevious'

export function previousPage(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null
  const value = (state as Record<string, unknown>)[RETURN_KEY]
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[\\\u0000-\u001f]/.test(value) ? value : null
}

// Preserve the previous in-app entry alongside Next's own history state.
// Unlike history.length, this cannot send a direct visitor to an external site.
export function trackBackNavigation(history: History, location: Location) {
  const push = history.pushState
  const replace = history.replaceState
  history.pushState = function (state, unused, url) {
    const from = location.pathname + location.search + location.hash
    return push.call(this, { ...state, [RETURN_KEY]: from }, unused, url)
  }
  history.replaceState = function (state, unused, url) {
    return replace.call(this, { ...state, [RETURN_KEY]: previousPage(this.state) }, unused, url)
  }
  return () => { history.pushState = push; history.replaceState = replace }
}
