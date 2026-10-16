// The text of a string field in JSON that is still being written (a streamed answer): what's there so far, or
// null before the field starts. `{"reply":"Comporta is gre` → `Comporta is gre`. An escape cut off mid-way waits.
const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' }
export function partialJsonString(json: string, key: string): string | null {
  const start = new RegExp(`"${key}"\\s*:\\s*"`).exec(json)
  if (!start) return null
  let out = ''
  for (let i = start.index + start[0].length; i < json.length; i++) {
    const char = json[i]
    if (char === '"') return out
    if (char !== '\\') { out += char; continue }
    const next = json[i + 1]
    if (next === undefined) return out
    if (next === 'u') {
      const hex = json.slice(i + 2, i + 6)
      if (hex.length < 4) return out
      out += String.fromCharCode(parseInt(hex, 16)); i += 5; continue
    }
    out += ESCAPES[next] ?? next; i++
  }
  return out
}
