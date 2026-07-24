const PEXELS_KEY = process.env.PEXELS_API_KEY

export async function fetchStockPhoto(query: string): Promise<string | null> {
  if (!PEXELS_KEY) {
    console.warn('[stockPhoto] PEXELS_API_KEY is not set')
    return null
  }
  console.log('[stockPhoto] fetching for query:', query)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
      { headers: { Authorization: PEXELS_KEY }, signal: controller.signal }
    )
    if (!res.ok) {
      console.error('[stockPhoto] Pexels API error', res.status, await res.text())
      return null
    }
    const data = await res.json()
    // Pick a random one from the first 3 so the same city doesn't always look identical
    const photos = data.photos ?? []
    if (photos.length === 0) {
      console.warn('[stockPhoto] no photos returned for query:', query)
      return null
    }
    const pick = photos[Math.floor(Math.random() * photos.length)]
    const url = pick.src?.large ?? pick.src?.medium ?? null
    console.log('[stockPhoto] selected url:', url)
    return url
  } catch (err) {
    console.error('[stockPhoto] fetch failed:', err)
    return null
  } finally {
    clearTimeout(timer)
  }
}
