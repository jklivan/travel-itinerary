// Older trips (before flights were filed under the stop they serve) have stops that only hold flights or transfers:
// flying out of JFK made "New York" a stop. Each one folds into the trip's next real stop, else the one before, like
// the planner's "Move into …" button.
type Stop = { id: string; name: string; order: number; items: { type: string }[] }

export function flightStopFolds<T extends Stop>(stops: T[]): { from: T; into: T }[] {
  const ordered = [...stops].sort((a, b) => a.order - b.order)
  const real = (stop: T) => stop.items.some(item => item.type !== 'transport')
  return ordered.flatMap((stop, index) => {
    if (!stop.items.length || real(stop)) return []
    const into = ordered.slice(index + 1).find(real) ?? ordered.slice(0, index).reverse().find(real)
    return into ? [{ from: stop, into }] : []
  })
}
