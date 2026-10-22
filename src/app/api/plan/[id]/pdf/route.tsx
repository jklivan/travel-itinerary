import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { formatDate, whenLabel, addDays } from '@/lib/placeDates'
import { inTimeOrder } from '@/lib/timeOrder'

export const maxDuration = 60

// The trip's itinerary as a PDF, for its owner only: every day in order, with times, addresses, notes, transport kept
// private and private booking details (confirmation numbers, seats). Nothing here is ever shown to anyone else.
const ink = '#1f3354', muted = '#6b7285', line = '#d7cebc', brown = '#8b6f4e', cream = '#faf7f1'
const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 10, color: ink, lineHeight: 1.4 },
  brand: { fontFamily: 'Playfair', fontSize: 9, letterSpacing: 3, color: brown, marginBottom: 6 },
  title: { fontFamily: 'Playfair', fontSize: 24, lineHeight: 1.25, marginBottom: 6 },
  subtitle: { fontSize: 10, color: muted, marginBottom: 18 },
  day: { fontFamily: 'Playfair', fontSize: 14, lineHeight: 1.3, marginTop: 14, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: line },
  place: { marginBottom: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: line },
  when: { fontSize: 9, color: brown, fontFamily: 'Helvetica-Bold' },
  name: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  kind: { fontSize: 8, color: muted, textTransform: 'uppercase', letterSpacing: 1 },
  detail: { fontSize: 9, color: muted },
  notes: { fontSize: 9, marginTop: 2 },
  booking: { fontSize: 9, marginTop: 3, padding: 5, backgroundColor: cream, borderRadius: 3 },
  footer: { position: 'absolute', bottom: 22, left: 44, right: 44, fontSize: 8, color: muted, flexDirection: 'row', justifyContent: 'space-between' },
})
const KIND: Record<string, string> = { hotel: 'Stay', food_drink: 'Food & drink', activity: 'Explore', transport: 'Getting around' }

type Item = { id: string; name: string; type: string; order: number; dayIndex: number | null; address: string | null; notes: string | null; bookingDetails: string | null; link: string | null; nights: number | null
  date: Date | null; time: string | null; endDate: Date | null; endTime: string | null; destination: string }

function PlaceBlock({ item }: { item: Item }) {
  const when = whenLabel({ date: item.date?.toISOString().slice(0, 10) ?? null, time: item.time, endDate: item.endDate?.toISOString().slice(0, 10) ?? null, endTime: item.endTime })
  return <View style={styles.place} wrap={false}>
    {!!when && <Text style={styles.when}>{when}</Text>}
    <Text style={styles.name}>{item.name}</Text>
    <Text style={styles.kind}>{KIND[item.type] ?? 'Place'}{item.type === 'hotel' && item.nights ? ` · ${item.nights} ${item.nights === 1 ? 'night' : 'nights'}` : ''}</Text>
    {!!item.address && <Text style={styles.detail}>{item.address}</Text>}
    {!!item.link && <Text style={styles.detail}>{item.link}</Text>}
    {!!item.notes && <Text style={styles.notes}>{item.notes}</Text>}
    {!!item.bookingDetails && <Text style={styles.booking}>Booking: {item.bookingDetails}</Text>}
  </View>
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = (await auth())?.user?.id
  if (!userId) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  const { id } = await params
  const trip = await prisma.itinerary.findFirst({ where: { id, userId }, select: { title: true, datesFlexible: true, startDate: true, endDate: true, durationDays: true,
    destinations: { orderBy: { order: 'asc' }, select: { name: true, country: true, items: { orderBy: { order: 'asc' }, select: { id: true, name: true, type: true, order: true, dayIndex: true, address: true, notes: true, bookingDetails: true, link: true, nights: true, date: true, time: true, endDate: true, endTime: true, tags: true } } } } } })
  if (!trip) return Response.json({ error: 'This trip is unavailable.' }, { status: 404 })

  Font.register({ family: 'Playfair', src: new URL('/fonts/playfair.ttf', request.url).toString() })
  Font.registerHyphenationCallback(word => [word])

  // Day numbers as the planner shows them (older trips counted from 0).
  const items: Item[] = trip.destinations.flatMap(destination => {
    const offset = destination.items.some(item => item.type !== 'hotel' && item.dayIndex === 0) ? 1 : 0
    return destination.items.filter(item => !item.tags.includes('__option')).map(item => ({ ...item, dayIndex: item.dayIndex === null ? null : item.dayIndex + offset,
      destination: [destination.name, destination.country].filter(Boolean).join(', ') }))
  })
  const start = trip.datesFlexible ? null : trip.startDate.toISOString().slice(0, 10)
  const lastDay = Math.max(trip.durationDays ?? 0, ...items.map(item => item.dayIndex ?? 0))
  const days = Array.from({ length: lastDay }, (_, index) => index + 1).map(day => ({ day, items: inTimeOrder(items.filter(item => item.dayIndex === day)) })).filter(day => day.items.length)
  const unscheduled = items.filter(item => item.dayIndex === null)
  const where = [...new Set(trip.destinations.filter(d => d.name !== 'Destination to decide').map(d => d.name))].join(' · ')
  const dates = start ? `${formatDate(start)} – ${formatDate(trip.endDate.toISOString().slice(0, 10))}` : trip.durationDays ? `${trip.durationDays} days` : ''

  const pdf = await renderToBuffer(<Document title={trip.title} author="Postcard">
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.brand}>POSTCARD · YOUR ITINERARY</Text>
      <Text style={styles.title}>{trip.title}</Text>
      <Text style={styles.subtitle}>{[where, dates].filter(Boolean).join(' · ')}</Text>
      {days.map(({ day, items: dayItems }) => <View key={day}>
        <Text style={styles.day} minPresenceAhead={60}>Day {day}{start ? ` · ${formatDate(addDays(start, day - 1))}` : ''}</Text>
        {dayItems.map(item => <PlaceBlock key={item.id} item={item} />)}
      </View>)}
      {unscheduled.length > 0 && <View>
        <Text style={styles.day} minPresenceAhead={60}>{days.length ? 'Not on a day yet' : 'Places'}</Text>
        {inTimeOrder(unscheduled).map(item => <PlaceBlock key={item.id} item={item} />)}
      </View>}
      {!items.length && <Text style={styles.detail}>No places in this trip yet.</Text>}
      <View style={styles.footer} fixed><Text>Private: includes your booking details. Made with Postcard.</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>
    </Page>
  </Document>)

  const file = `${trip.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'itinerary'}.pdf`
  return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${file}"`, 'Cache-Control': 'private, no-store' } })
}
