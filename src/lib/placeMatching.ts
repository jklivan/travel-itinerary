// Deciding whether two saved places are the same real place (friends' "liked this" on planner places).

// Words that only describe a kind of outing. A name made only of these ("Wine tasting", "Beach day", "Dinner")
// says nothing about which place it was, so matching it needs the location to agree too.
const GENERIC_WORDS = new Set(('a an the and of at in on with to day night trip tour tours tasting tastings wine wines winery vineyard ' +
  'beach beaches hike hiking walk walking trail dinner lunch breakfast brunch coffee drinks bar pub cafe restaurant hotel stay ' +
  'museum boat sail sailing park parks shopping market spa swim swimming pool golf mini ski skiing bike biking ride picnic sunset sunrise ' +
  'ice cream pizza sushi tacos bbq brewery beer cocktails show concert game kayak kayaking snorkel snorkeling fishing zoo aquarium ' +
  'garden gardens church castle old town city center downtown mall lake river mountain view viewpoint farm orchard apple picking ' +
  'bowling movie movies theater theatre massage yoga class cooking lesson lessons airport train station ferry taxi uber rental car ' +
  'local fun family kids date visit').split(' '))
export function genericPlaceName(name: string) {
  const words = name.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  return words.length > 0 && words.every(word => GENERIC_WORDS.has(word))
}
export function metresApart(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}
export function sameAddress(a: string, b: string) {
  const normal = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  return normal(a) === normal(b)
}
