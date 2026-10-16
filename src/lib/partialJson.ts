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

// Where the JSON value starting at `from` (an object or array) ends, or -1 if it isn't finished yet.
function valueEnd(json: string, from: number) {
  let depth = 0, inString = false
  for (let i = from; i < json.length; i++) {
    const char = json[i]
    if (inString) { if (char === '\\') i++; else if (char === '"') inString = false; continue }
    if (char === '"') inString = true
    else if (char === '{' || char === '[') depth++
    else if (char === '}' || char === ']') { depth--; if (!depth) return i + 1 }
  }
  return -1
}
const valueStart = (json: string, key: string, open: string) => {
  const match = new RegExp(`"${key}"\\s*:\\s*\\${open}`).exec(json)
  return match ? match.index + match[0].length - 1 : -1
}

// An object field once it's completely written (`"ask":{…}`), else null.
export function finishedJsonObject<T>(json: string, key: string): T | null {
  const start = valueStart(json, key, '{')
  const end = start < 0 ? -1 : valueEnd(json, start)
  if (end < 0) return null
  try { return JSON.parse(json.slice(start, end)) as T } catch { return null }
}

// The objects in an array field that are completely written so far (`"recommendations":[{…},{…},{…` → the first two).
export function finishedJsonItems<T>(json: string, key: string): T[] {
  const start = valueStart(json, key, '[')
  if (start < 0) return []
  const items: T[] = []
  for (let i = start + 1; i < json.length;) {
    const char = json[i]
    if (char === ']') break
    if (char !== '{') { i++; continue }
    const end = valueEnd(json, i)
    if (end < 0) break
    try { items.push(JSON.parse(json.slice(i, end)) as T) } catch { break }
    i = end
  }
  return items
}
