// Keeps Postcard on its approved styles (see /styleguide and AGENTS.md): palette colours only, and text sizes from
// the approved scale. Fails with the file and the offending class, so drift is caught when it's written.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../src/', import.meta.url).pathname
function files(dir, ext) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return ['generated', 'admin'].includes(name) ? [] : files(path, ext)
    return ext.some(e => name.endsWith(e)) ? [path] : []
  })
}
const tsx = files(root, ['.tsx'])
const css = files(root, ['.module.css'])
const problems = (list, pattern) => list.flatMap(path => [...readFileSync(path, 'utf8').matchAll(pattern)].map(m => `${path.replace(root, '')}: ${m[0].trim()}`))

test('colours come from the palette (no stock Tailwind colours or hex in class names)', () => {
  assert.deepEqual(problems(tsx, /\b(?:text|bg|border|ring|fill|stroke|placeholder|from|to)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g), [])
  assert.deepEqual(problems(tsx, /\b(?:text|bg|border|ring|from|to)-\[#[0-9a-fA-F]{3,8}\]/g), [])
})
test('text sizes come from the approved scale', () => {
  // Allowed: text-micro, text-label, text-xs, text-sm, text-base, text-lg, text-title, text-display, text-display-lg.
  assert.deepEqual(problems(tsx, /(?<![\w-])text-(?:xl|[2-9]xl|\[\d[^\]]*\])(?![\w-])/g), [])
  const scale = new Set(['9px', '11px', '12px', '14px', '16px', '18px', '22px', '32px', '40px'])
  assert.deepEqual(problems(css, /font-size:\s*[0-9.]+(?:px|rem)/g).filter(line => !scale.has(line.split(/font-size:\s*/)[1])), [])
})
test('letter spacing and headings use the approved styles', () => {
  // Letter spacing: tracking-tight/normal/wide/wider/widest/caps/label/brand only, no one-off values.
  assert.deepEqual(problems(tsx, /(?<![\w-])tracking-\[[^\]]+\]/g), [])
  // Headings with a fixed class list name one of the approved text styles.
  const headings = problems(tsx, /<h[1-4](?:\s[^>]*?)?\sclassName="[^"]*"/g).filter(line => !/\b(type-(display|title|card|body|meta|label|micro)|page-title|trip-title|sr-only)\b/.test(line))
  assert.deepEqual(headings, [])
})
test('buttons, corner rounding and shadows use the approved styles', () => {
  // Shadows: shadow-card, shadow-pop, shadow-nav (or none). Rounding: lg, xl, 2xl, full, and corner variants.
  assert.deepEqual(problems(tsx, /(?<![\w-])shadow(?:-(?:sm|md|lg|xl|2xl)|-\[[^\]]+\])?(?![\w\[-])/g).filter(line => !/transition-shadow|drop-shadow|box-shadow/.test(line)), [])
  assert.deepEqual(problems(tsx, /(?<![\w-])rounded(?:-(?:sm|md|3xl|\[[^\]]+\]))?(?![\w\[-])/g), [])
  // Solid filled pill buttons are the shared btn styles, not hand-built.
  assert.deepEqual(problems(tsx, /<(?:button|Link)\b[^>]*className="(?![^"]*\bbtn\b)[^"]*\brounded-full\b[^"]*(?<![:\w-])bg-(?:ink|link|danger)(?![\w/-])[^"]*"/g).filter(line => !line.startsWith('components/WelcomeScreen')), [])
})

