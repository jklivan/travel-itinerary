export function eventPhotos(photos?: readonly string[] | null, legacyPhoto?: string | null): string[] {
  const values = Array.isArray(photos) && photos.length ? photos : typeof legacyPhoto === 'string' && legacyPhoto ? [legacyPhoto] : []
  return [...new Set(values.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))]
}

export function pickEventPhoto(photos: readonly string[], random = Math.random()): string | null {
  return photos.length ? photos[Math.min(photos.length - 1, Math.max(0, Math.floor(random * photos.length)))] : null
}

export function tripPhotoGallery(tripPhotos: { id: string; url: string; caption: string | null; isStock?: boolean }[], items: { id: string; name: string; photoUrls?: string[]; photoUrl?: string | null }[]) {
  const seen = new Set<string>()
  return [
    ...tripPhotos.filter(photo => !photo.isStock),
    ...items.flatMap(item => eventPhotos(item.photoUrls, item.photoUrl).map((url, index) => ({ id: `${item.id}-photo-${index}`, url, caption: item.name }))),
  ].filter(photo => {
    if (seen.has(photo.url)) return false
    seen.add(photo.url)
    return true
  })
}
