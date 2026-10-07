<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design consistency

Postcard should look the same on every page. Keep styling in one place.

- **Colours come only from the palette** in `src/app/globals.css` (`@theme static`). Use the names — `text-ink`, `text-ink-soft`, `text-link`, `text-muted`, `text-brown`, `bg-paper`, `bg-cream`, `bg-card`, `bg-chip`, `bg-mist`, `border-line`, `border-line-soft`, `text-gold`, `text-danger`, … — never hex codes like `text-[#1f3354]`. In CSS modules use `var(--color-ink)` etc. Need a new colour? Add it to the palette first, and only if no existing one fits.
- **Shared classes in `globals.css`**: `page-wrap` + `page-header` / `page-title` / `page-subtitle` (top of main pages), `tabs` / `tab` (view tabs), `field-label` (form section labels), `ui/PolaroidTile` (option tiles: Explore, trip types, plan choices), `photo-polaroid` / `photo-polaroid-image` (real photos: places, snapshots, trip covers), `ui/Stamp` (Must go! / Must do!), `chip` (tappable pills; navy when `aria-pressed`), `btn` / `btn-primary` / `btn-outline`, `panel`.
- **Every button is one of the shared styles**: `btn btn-primary` (main action), `btn btn-outline` (secondary, Cancel), `btn btn-danger` (delete), `btn-sm` to make any of them smaller, `btn-icon` (round icon button), `chip` (toggles and small pills; `chip-like` for the Like pill), `tab`. Plain text links are fine. No hand-built filled or bordered buttons. `tests/designSystem.test.mjs` enforces this and runs at the start of every build, so a hand-built button fails the deploy. Real exceptions go in its `BUTTON_EXCEPTIONS` list with a reason.
- **Reuse shared components** instead of restyling inline: `UserAvatar` (people), `ItineraryCard` (trip cards), `RatingStars` (stars), `ui/TagChip` + `TAG_PILL` (travel-style tags and the pills beside them on a trip), `STAMP_COLORS` from `lib/tripStamps` (verdict colours), the polaroid card styles in `itinerary/[id]/places.module.css`.
- **When you change how something looks** (a button, chip, card, heading, stars, avatar), search for every other place that shows the same thing and change those too. If you leave any, say which.
- **After a visual change**, check it at phone width on: Feed, Explore, Plan, the planner, a trip page, Saved, Profile, snapshots, and the AI planner.
