// Read-only by default. Run with --env <file> --apply after reviewing the matches.
import { config } from 'dotenv'
import { neon } from '@neondatabase/serverless'
const envIndex = process.argv.indexOf('--env')
config({ path: envIndex >= 0 ? process.argv[envIndex + 1] : '.env.local', quiet: true })
config({ path: '.env', quiet: true })
const requests = [
  { author: 'Joshua Klivan', words: ['1', 'night', 'boston'] },
  { author: 'Joshua Klivan', words: ['watersports', 'southern', 'ct'] },
  { author: 'Jennifer Rosenthal', words: ['ct', 'tubing', 'waterskiing'] },
]
try {
  const url = new URL(process.env.DATABASE_URL ?? '')
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Invalid database URL')
  const sql = neon(url.toString())
  const rows = await sql`SELECT i.id, i.title, i.tags, u.name AS author FROM "Itinerary" i JOIN "User" u ON u.id = i."userId" WHERE lower(u.name) IN ('joshua klivan', 'jennifer rosenthal')`
  const selected = requests.map(request => {
    const matches = rows.filter(row => row.author.toLowerCase() === request.author.toLowerCase() && request.words.every(word => row.title.toLowerCase().split(/[^a-z0-9]+/).includes(word)))
    if (matches.length !== 1) throw new Error(`Expected one match for ${request.author}: ${request.words.join(' ')}; found ${matches.length}. No changes made.`)
    return matches[0]
  })
  console.log(JSON.stringify(selected, null, 2))
  if (process.argv.includes('--apply')) {
    const results = await sql.transaction(selected.map(row => sql`UPDATE "Itinerary" SET tags = array_append(tags, 'day-trip') WHERE id = ${row.id} AND title = ${row.title} AND NOT ('day-trip' = ANY(tags)) RETURNING id, title, tags`))
    console.log(JSON.stringify({ updated: results.flat() }, null, 2))
  } else console.log('Preview only. Add --apply to tag these three posts.')
} catch (error) {
  // Connection errors can include credentials; never print those errors.
  console.error(error.message.startsWith('Expected one match') ? error.message : 'Could not access the database. No confirmed changes; check the connection and rerun the preview.')
  process.exitCode = 1
}
