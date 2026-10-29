// "Book on Marriott" for Marriott Bonvoy hotels: booking on Marriott's own site earns the traveler Bonvoy points and
// elite nights, and members usually pay less there. The link opens Marriott's search at the hotel (it sorts nearest
// first, so the hotel is at the top) with the dates and guests filled in.
// Commission needs Marriott's affiliate link: once approved, set NEXT_PUBLIC_MARRIOTT_AFFILIATE_URL to the network's
// deep-link prefix (the part that ends in "url=") and every button goes through it.

// Marriott Bonvoy brands as they appear in hotel names ("W " only at the start: "W Barcelona").
const BRANDS = /\b(JW Marriott|Marriott|Ritz[- ]Carlton|St\.? Regis|Westin|Sheraton|Le M[ée]ridien|Renaissance|Autograph Collection|Luxury Collection|EDITION|Courtyard|Residence Inn|Fairfield (Inn|by Marriott)|SpringHill Suites|TownePlace|AC Hotel|Aloft|Moxy|Four Points|Element by Westin|Delta Hotels|Gaylord|Tribute Portfolio|Bvlgari Hotel|Protea Hotel)\b|^W [A-Z]/i

export const isMarriottHotel = (name: string) => BRANDS.test(name.trim())

const usDate = (iso: string) => { const [year, month, day] = iso.split('-'); return `${month}/${day}/${year}` }
const isDate = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)

export function marriottLink(hotel: { name: string; destination: string; country: string | null }, stay?: { start: string; end: string } | null, adults = 2) {
  const params = new URLSearchParams({ 'destinationAddress.destination': [hotel.name, hotel.destination, hotel.country].filter(Boolean).join(', '), roomCount: '1', numAdultsPerRoom: String(Math.min(Math.max(adults, 1), 4)), childrenCount: '0' })
  // Past or half-known dates are left out: Marriott then asks for them.
  if (stay && isDate(stay.start) && isDate(stay.end) && stay.end > stay.start && stay.start >= new Date().toISOString().slice(0, 10)) { params.set('fromDate', usDate(stay.start)); params.set('toDate', usDate(stay.end)) }
  const url = `https://www.marriott.com/search/findHotels.mi?${params}`
  const affiliate = process.env.NEXT_PUBLIC_MARRIOTT_AFFILIATE_URL
  return affiliate ? `${affiliate}${encodeURIComponent(url)}` : url
}
