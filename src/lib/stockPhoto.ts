const PEXELS_KEY = process.env.PEXELS_API_KEY

export async function fetchStockPhoto(query: string): Promise<string | null> {
  if (!PEXELS_KEY) return null
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
      { headers: { Authorization: PEXELS_KEY } }
    )
    if (!res.ok) return null
    const data = await res.json()
    // Pick a random one from the first 3 so the same city doesn't always look identical
    const photos = data.photos ?? []
    if (photos.length === 0) return null
    const pick = photos[Math.floor(Math.random() * photos.length)]
    return pick.src?.large ?? pick.src?.medium ?? null
  } catch {
    return null
  }
}
