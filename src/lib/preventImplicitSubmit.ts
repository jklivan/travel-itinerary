import type { KeyboardEvent } from 'react'

// Enter in a text input must not save/publish a whole itinerary. Let textarea
// newlines, autocomplete handlers, and keyboard activation of buttons work.
export function preventImplicitSubmit(event: KeyboardEvent<HTMLFormElement>) {
  if (event.key !== 'Enter' || event.defaultPrevented) return
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' && !['submit', 'button', 'reset', 'checkbox', 'radio', 'file'].includes((target as HTMLInputElement).type)) {
    event.preventDefault()
  }
}
