// An emailed trip still being imported (Itinerary.importingSince, set by lib/inboxImport). Ten minutes on it's
// treated as finished, in case an import died without clearing it.
const IMPORT_TIMEOUT_MS = 10 * 60 * 1000
export const stillImporting = (since: Date | null) => !!since && Date.now() - since.getTime() < IMPORT_TIMEOUT_MS
