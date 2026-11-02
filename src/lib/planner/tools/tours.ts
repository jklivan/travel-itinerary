import { fail, int, isoDate, ok, text, type PlannerTool } from '../types'

// Tours, activities and attraction tickets from Viator (Basic Access affiliate API): search, then the details of one
// tour (what's included, meeting point, cancellation, who it suits, how its ratings split, whether it runs on given
// dates). Review text isn't part of Basic Access (Viator refuses it), so the planner reads reviews on the web instead.
// The sandbox key goes to Viator's sandbox (VIATOR_API_URL on previews); links carry our affiliate code.

const base = () => process.env.VIATOR_API_URL || 'https://api.viator.com/partner'

async function viator<T>(path: string, init: RequestInit & { signal?: AbortSignal } = {}): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const key = process.env.VIATOR_API_KEY?.trim()
  if (!key) return { ok: false, error: 'Tours and tickets aren’t connected yet (no Viator key).' }
  const response = await fetch(`${base()}${path}`, { ...init, signal: init.signal ?? AbortSignal.timeout(10_000),
    headers: { 'exp-api-key': key, 'Accept-Language': 'en-US', Accept: 'application/json;version=2.0', 'Content-Type': 'application/json' } })
  if (!response.ok) {
    // What Viator said and which server (never the key), so a refusal can be traced.
    const said = await response.text().then(body => body.slice(0, 200)).catch(() => '')
    console.warn('[tours] Viator refused', response.status, path.split('?')[0], new URL(base()).host, `key ${key.length} chars`, said)
    const reason = (() => { try { return (JSON.parse(said) as { message?: string }).message } catch { return undefined } })()
    return { ok: false, error: `Viator lookup failed (${response.status}${reason ? `: ${reason.slice(0, 120)}` : ''}).` }
  }
  return { ok: true, data: await response.json() as T }
}

type Product = { productCode?: string; title?: string; productUrl?: string; pricing?: { summary?: { fromPrice?: number } }; reviews?: { combinedAverageRating?: number; totalReviews?: number }; duration?: { fixedDurationInMinutes?: number; variableDurationFromMinutes?: number; variableDurationToMinutes?: number }; flags?: string[] }
const minutesOf = (duration: Product['duration']) => duration?.fixedDurationInMinutes ?? duration?.variableDurationFromMinutes
const round = (value?: number) => value == null ? undefined : Math.round(value * 100) / 100

export const toursTool: PlannerTool = {
  name: 'tours',
  description: 'Search bookable tours, activities and attraction tickets (Viator), e.g. "Sintra day trip from Lisbon", "food tour Trastevere", "Vatican skip-the-line". Optional filters: dates (only tours running then), minimum rating, maximum price per person, and sorting. Returns each tour\'s code, title, price from (per person unless private), rating, review count, length, flags such as free cancellation, and a link. Use tour_details on the ones you might recommend.',
  inputSchema: { type: 'object', additionalProperties: false, required: ['query'], properties: {
    query: { type: 'string', description: 'What and where.' },
    start_date: { type: 'string', description: 'YYYY-MM-DD: only tours available from this date (with end_date).' },
    end_date: { type: 'string', description: 'YYYY-MM-DD.' },
    min_rating: { type: 'number', minimum: 1, maximum: 5, description: 'e.g. 4.5' },
    max_price: { type: 'number', description: 'Highest price per person, USD.' },
    sort: { type: 'string', enum: ['relevance', 'rating', 'price_low', 'price_high'] },
    limit: { type: 'integer', minimum: 1, maximum: 10 },
  } },
  async run(input, { signal }) {
    const query = text(input.query, 150)
    if (!query) return fail('Say what to look for.')
    const from = isoDate(input.start_date), to = isoDate(input.end_date) ?? from
    const minRating = typeof input.min_rating === 'number' ? Math.min(5, Math.max(1, input.min_rating)) : null
    const maxPrice = typeof input.max_price === 'number' && input.max_price > 0 ? input.max_price : null
    const sorting = ({ rating: { sort: 'REVIEW_AVG_RATING', order: 'DESCENDING' }, price_low: { sort: 'PRICE', order: 'ASCENDING' }, price_high: { sort: 'PRICE', order: 'DESCENDING' } } as Record<string, unknown>)[String(input.sort)]
    const result = await viator<{ products?: { results?: Product[]; totalCount?: number } }>('/search/freetext', { method: 'POST', signal, body: JSON.stringify({
      searchTerm: query, currency: 'USD',
      ...((from || minRating || maxPrice) ? { productFiltering: { ...(from && to ? { dateRange: { from, to } } : {}), ...(minRating ? { rating: { from: minRating, to: 5 } } : {}), ...(maxPrice ? { price: { from: 0, to: maxPrice } } : {}) } } : {}),
      ...(sorting ? { productSorting: sorting } : {}),
      searchTypes: [{ searchType: 'PRODUCTS', pagination: { start: 1, count: int(input.limit, 1, 10) ?? 6 } }],
    }) })
    if (!result.ok) return fail(result.error)
    const products = result.data.products?.results ?? []
    if (!products.length) return ok(`No tours found for "${query}"${from ? ` on those dates` : ''}.`)
    return ok(products.map(product => ({ code: product.productCode, title: product.title, from_price_usd: round(product.pricing?.summary?.fromPrice), rating: round(product.reviews?.combinedAverageRating), reviews: product.reviews?.totalReviews, minutes: minutesOf(product.duration), flags: product.flags?.filter(flag => /FREE_CANCELLATION|LIKELY_TO_SELL_OUT|PRIVATE_TOUR|SKIP_THE_LINE|SPECIAL_OFFER/.test(flag)), url: product.productUrl })))
  },
}

type Details = {
  title?: string; description?: string; productUrl?: string
  inclusions?: { otherDescription?: string; description?: string; typeDescription?: string }[]
  exclusions?: { otherDescription?: string; description?: string; typeDescription?: string }[]
  additionalInfo?: { type?: string; description?: string }[]
  cancellationPolicy?: { description?: string; type?: string }
  logistics?: { start?: { description?: string; location?: { ref?: string } }[]; travelerPickup?: { pickupOptionType?: string; additionalInfo?: string } }
  pricingInfo?: { type?: string; ageBands?: { ageBand?: string; startAge?: number; endAge?: number; minTravelersPerBooking?: number; maxTravelersPerBooking?: number }[] }
  reviews?: { combinedAverageRating?: number; totalReviews?: number; reviewCountTotals?: { rating?: number; count?: number }[] }
  itinerary?: { duration?: Product['duration']; itineraryType?: string }
}
type Schedules = { bookableItems?: { seasons?: { startDate?: string; endDate?: string; pricingRecords?: { daysOfWeek?: string[]; timedEntries?: { startTime?: string; unavailableDates?: { date?: string }[] }[] }[] }[] }[] }

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
const words = (value?: string, max = 600) => value ? value.replace(/\s+/g, ' ').trim().slice(0, max) : undefined
const item = (entry: { otherDescription?: string; description?: string; typeDescription?: string }) => words(entry.otherDescription || entry.description || entry.typeDescription, 120)

// Whether the tour runs on each of the dates (its seasons, weekdays and blacked-out dates), with start times.
function runsOn(schedules: Schedules, dates: string[]) {
  return dates.map(date => {
    const weekday = DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]
    const times = new Set<string>()
    for (const bookable of schedules.bookableItems ?? []) for (const season of bookable.seasons ?? []) {
      if ((season.startDate && date < season.startDate) || (season.endDate && date > season.endDate)) continue
      for (const record of season.pricingRecords ?? []) {
        if (record.daysOfWeek?.length && !record.daysOfWeek.includes(weekday)) continue
        for (const entry of record.timedEntries?.length ? record.timedEntries : [{}]) {
          if (entry.unavailableDates?.some(unavailable => unavailable.date === date)) continue
          times.add(entry.startTime ?? 'any time')
        }
      }
    }
    return { date, runs: times.size > 0, ...(times.size ? { starts: [...times].sort().slice(0, 6) } : {}) }
  })
}

export const tourDetailsTool: PlannerTool = {
  name: 'tour_details',
  description: 'Everything about one Viator tour, by its code from tours: a short description, what\'s included and not, meeting point or pickup, cancellation policy, ages it\'s for, rating and how many reviews gave each star (a high share of 1-2 stars is a warning), and, given dates, whether it runs on each and its start times. Use it before recommending a tour, to check it fits the traveler (kids\' ages, budget, pace) and their dates. For what reviewers say, search the web for the tour\'s reviews.',
  inputSchema: { type: 'object', additionalProperties: false, required: ['code'], properties: {
    code: { type: 'string', description: 'The tour\'s code from tours.' },
    dates: { type: 'array', items: { type: 'string' }, description: 'Up to 7 dates (YYYY-MM-DD) to check it runs on.' },
  } },
  async run(input, { signal }) {
    const code = text(input.code, 40)
    if (!/^[A-Za-z0-9-]+$/.test(code)) return fail('Give the tour\'s code from tours.')
    const dates = (Array.isArray(input.dates) ? input.dates : []).map(isoDate).filter((date): date is string => !!date).slice(0, 7)
    const [details, schedules] = await Promise.all([
      viator<Details>(`/products/${encodeURIComponent(code)}`, { signal }),
      dates.length ? viator<Schedules>(`/availability/schedules/${encodeURIComponent(code)}`, { signal }) : Promise.resolve(null),
    ])
    if (!details.ok) return fail(details.error)
    const tour = details.data
    // How the ratings split: "5★ 91%, 4★ 6%, 1-2★ 2%".
    const counts = tour.reviews?.reviewCountTotals ?? [], total = counts.reduce((sum, entry) => sum + (entry.count ?? 0), 0)
    const share = (stars: number[]) => total ? Math.round(counts.filter(entry => stars.includes(entry.rating ?? 0)).reduce((sum, entry) => sum + (entry.count ?? 0), 0) / total * 100) : null
    return ok({
      code, title: tour.title, url: tour.productUrl,
      about: words(tour.description, 700),
      minutes: minutesOf(tour.itinerary?.duration),
      included: tour.inclusions?.map(item).filter(Boolean).slice(0, 10),
      not_included: tour.exclusions?.map(item).filter(Boolean).slice(0, 8),
      meeting: tour.logistics?.travelerPickup?.pickupOptionType === 'PICKUP_EVERYONE' ? 'Hotel pickup included' : words(tour.logistics?.start?.[0]?.description, 200),
      cancellation: words(tour.cancellationPolicy?.description, 300),
      ages: tour.pricingInfo?.ageBands?.map(band => `${band.ageBand?.toLowerCase()} ${band.startAge}-${band.endAge}`),
      notes: tour.additionalInfo?.map(info => words(info.description, 160)).filter(Boolean).slice(0, 8),
      rating: round(tour.reviews?.combinedAverageRating), total_reviews: tour.reviews?.totalReviews,
      ...(total ? { ratings_split: `5★ ${share([5])}%, 4★ ${share([4])}%, 3★ ${share([3])}%, 1-2★ ${share([1, 2])}%` } : {}),
      ...(dates.length ? schedules?.ok ? { on_your_dates: runsOn(schedules.data, dates) } : { on_your_dates: 'Availability couldn’t be checked; say to check on Viator.' } : {}),
    })
  },
}
