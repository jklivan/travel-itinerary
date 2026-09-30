<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design consistency

Postcard should look the same on every page. Keep styling in one place.

- **Colours come only from the palette** in `src/app/globals.css` (`@theme static`). Use the names — `text-ink`, `text-ink-soft`, `text-link`, `text-muted`, `text-brown`, `bg-paper`, `bg-cream`, `bg-card`, `bg-chip`, `bg-mist`, `border-line`, `border-line-soft`, `text-gold`, `text-danger`, … — never hex codes like `text-[#1f3354]`. In CSS modules use `var(--color-ink)` etc. Need a new colour? Add it to the palette first, and only if no existing one fits.
- **Reuse shared components** instead of restyling inline: `UserAvatar` (people), `ItineraryCard` (trip cards), `RatingStars` (stars), `TAG_CHIP` + `STAMP_COLORS` from `lib/tripStamps` (chips and verdicts), the polaroid card styles in `itinerary/[id]/places.module.css`.
- **When you change how something looks** (a button, chip, card, heading, stars, avatar), search for every other place that shows the same thing and change those too. If you leave any, say which.
- **After a visual change**, check it at phone width on: Feed, Explore, Plan, the planner, a trip page, Saved, Profile, snapshots, and the AI planner.
