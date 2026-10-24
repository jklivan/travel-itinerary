import Link from 'next/link'
import { redirect } from 'next/navigation'
import { flightStopPlan } from '@/actions/adminFlightStops'
import FixFlightStops from '@/components/FixFlightStops'

// Admin: older trips whose flights became a stop of their own ("New York" for a flight out of JFK). Lists each
// one and where its flights would go, with one button to fold them all in.
export default async function FlightStopsPage() {
  const plan = await flightStopPlan()
  if (!plan) redirect('/')
  return <div className="page-wrap">
    <header className="page-header"><h1 className="page-title">Flights-only stops</h1>
      <p className="page-subtitle">{plan.length ? `${plan.length} ${plan.length === 1 ? 'stop' : 'stops'} in older trips only hold flights or transfers. Each moves into the trip’s next real stop (or the one before), then the empty stop is removed.` : 'No trips have a stop that only holds flights.'}</p></header>
    {plan.length > 0 && <FixFlightStops count={plan.length} />}
    <ul className="mt-4 space-y-2">{plan.map(fold => <li key={fold.from.id} className="panel p-3 text-sm">
      <Link href={`/${fold.posted ? 'itinerary' : 'plan'}/${fold.tripId}`} className="font-semibold text-link">{fold.title}</Link>
      <span className="text-muted"> · {fold.owner}{fold.posted ? ' · posted' : ' · private plan'}</span>
      <p className="mt-1 text-ink"><strong>{fold.from.name}</strong> → <strong>{fold.into.name}</strong>{fold.from.days ? ` (adds ${fold.from.days} ${fold.from.days === 1 ? 'day' : 'days'})` : ''}</p>
      <p className="text-muted">{fold.from.places.join(', ')}</p>
    </li>)}</ul>
  </div>
}
