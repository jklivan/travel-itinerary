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
// Buttons allowed to look their own way, each for a reason: [file, a bit of its className].
const BUTTON_EXCEPTIONS = [
  ['components/WelcomeScreen', ''], // sign-in buttons over the harbour photo
  ['components/EventPhotoInput', 'absolute -top-1'], // tiny remove-x on a photo thumbnail
  ['components/SwipeToDelete', 'absolute inset-y-0'], // the red panel revealed by swiping
  ['components/ui/TagChip', 'TAG_PILL'], // the shared tag pill itself
]
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
  // Every button is a shared style (btn / chip / btn-icon / tab). Catches hand-built ones: filled, outlined boxes or pills, or button-sized.
  const buttons = tsx.flatMap(path => [...readFileSync(path, 'utf8').matchAll(/<(?:button|Link)\b(?:[^>]|=>)*?className=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
    .map(m => [path.replace(root, ''), m[1] ?? m[2]]))
  const handBuilt = buttons.filter(([, cls]) => !/(?<![\w-])(?:btn|chip|btn-icon|tab)(?![\w-])/.test(cls)
    && !/\bborder-dashed\b/.test(cls) // dashed "+ Add" rows are their own pattern
    && (/(?<![:\w-])bg-(?:ink|link|danger)(?![\w/-])/.test(cls) // filled
      || (/\brounded-(?:full|lg|xl)\b/.test(cls) && /(?<![:\w-])border(?![\w-])/.test(cls) && /\bpx-/.test(cls)))) // outlined box or pill
    .filter(([name, cls]) => !BUTTON_EXCEPTIONS.some(([file, bit]) => name.startsWith(file) && cls.includes(bit)))
    .map(([name, cls]) => `${name}: ${cls}`)
  assert.deepEqual(handBuilt, [])
})

// Finds where a JSX tag ends, skipping over {…} and strings, so arrow functions inside don't cut it short.
function tagEnd(text, i) {
  let depth = 0, quote = null
  for (; i < text.length; i++) {
    const c = text[i]
    if (quote) { if (c === quote && text[i - 1] !== '\\') quote = null; continue }
    if (c === '"' || c === '`' || (c === "'" && depth)) { quote = c; continue }
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0) return i
  }
  return text.length
}
// Fields allowed to look their own way: the search boxes (ui/SearchField and the Explore landing pill) and the
// snapshot composer, whose fields are styled to match in Stories.module.css.
const FIELD_EXCEPTIONS = ['components/ui/SearchField', 'components/ExploreLanding', 'components/StoryComposer', 'components/PostTripDialog']

test('text boxes, note boxes and dropdowns use the shared field style', () => {
  const handBuilt = tsx.flatMap(path => {
    const name = path.replace(root, ''), text = readFileSync(path, 'utf8')
    if (FIELD_EXCEPTIONS.some(prefix => name.startsWith(prefix))) return []
    return [...text.matchAll(/<(input|textarea|select)\b/g)].flatMap(m => {
      const tag = text.slice(m.index, tagEnd(text, m.index + 1))
      if (/type="(?:checkbox|radio|hidden|file|range)"/.test(tag)) return []
      const cls = tag.match(/className=("[^"]*"|\{`[^`]*`\}|\{[^{}]*\})/)?.[1] ?? '(no className)'
      // `field` directly, or a shared constant that is `field` (inputClass, inputCls, subInputCls), or a passed-in className.
      return /(?<![\w-])field(?![\w-])|\{`?\$?\{?(?:inputClass|inputCls|subInputCls|className)\b/.test(cls) ? [] : [`${name}:${text.slice(0, m.index).split('\n').length} ${cls}`]
    })
  })
  assert.deepEqual(handBuilt, [])
  // The shared constants really are the shared style.
  for (const [file, name] of [['app/plan/NewPlanForm.tsx', 'inputClass'], ['components/PlaceEditForm.tsx', 'inputCls'], ['components/PlaceEditForm.tsx', 'subInputCls'], ['components/PlaceEntryForm.tsx', 'inputCls']])
    assert.match(readFileSync(root + file, 'utf8'), new RegExp(`export const ${name} = '(?:[\\w.-]+ )*field(?: [\\w.-]+)*'`), `${file} ${name}`)
})


// Boxes allowed to look their own way, each for a reason: [file, a bit of its className].
const BOX_EXCEPTIONS = [
  ['components/CopyTripButton', 'fixed inset-0'], // pop-up dialog
  ['components/PlacesAutocomplete', 'absolute z-50'], // dropdown of place suggestions
  ['components/MessageThread', 'w-fit'], // chat bubbles
  ['app/testplan/TestPlanner', 'sticky bottom'], // the AI chat's message bar
  ['app/testplan/TestPlanner', 'ml-auto w-fit'], // a chat bubble
  ['components/ItineraryCard', 'p-2.5'], // the text block on a trip card
  ['components/MessageAttachment', 'border-t-2'], // a trip attached to a message
  ['components/MessageComposer', 'border-l-4'], // the quoted message you're replying to
  ['components/PlaceEntryForm', 'cfg.color'], // tinted by place category
  ['app/itinerary/[id]/page', 'bg-sand'], // the "visible to" notice on your own trip
  ['components/PlanFriendsBrowser', 'fixed inset-x-4'], // floating "Add places" bar
  ['components/ui/SearchField', 'pl-10'], // the search box (a field, not a box)
]

test('boxes use the shared panel styles', () => {
  const handBuilt = tsx.flatMap(path => {
    const name = path.replace(root, ''), text = readFileSync(path, 'utf8')
    return [...text.matchAll(/<([A-Za-z]\w*)\b/g)].flatMap(m => {
      const tag = m[1], whole = text.slice(m.index, tagEnd(text, m.index + 1))
      const found = whole.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/)
      if (!found) return []
      const cls = found[1] ?? found[2]
      if (['button', 'input', 'textarea', 'select', 'img'].includes(tag)) return [] // buttons and fields have their own checks
      if (/(?<![\w-])(?:panel|panel-hint|panel-dashed|panel-inset|chip|btn|btn-icon|field|photo-polaroid)(?![\w-])/.test(cls)) return []
      const boxy = /\brounded-(?:lg|xl|2xl)\b/.test(cls) && /(?<![:\w-])border(?![\w-]*-[tblr]\b)(?:-(?:dashed|line|line-soft|line-strong|sand|mist-line|mist-edge|link))?(?![\w-])/.test(cls)
      const filled = /(?<![:\w-])bg-(?:cream|card|white|mist|sand|paper)(?![\w/-])/.test(cls) || /\bborder-dashed\b/.test(cls)
      if (!boxy || !filled) return []
      if (BOX_EXCEPTIONS.some(([file, bit]) => name.startsWith(file) && cls.includes(bit))) return []
      return [`${name}:${text.slice(0, m.index).split('\n').length} <${tag}> ${cls.slice(0, 120)}`]
    })
  })
  assert.deepEqual(handBuilt, [])
})
