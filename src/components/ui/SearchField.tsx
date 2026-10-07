import type { InputHTMLAttributes, Ref } from 'react'
import { Search } from 'lucide-react'

// The one search box: magnifier on the left, navy button inside on the right (Explore, Friends, Browse friends' places,
// tagging a trip). Put it in a <form> and the button submits; or pass onButtonClick where a form can't be used.
export default function SearchField({ buttonLabel, buttonDisabled, onButtonClick, className = '', ref, ...input }: InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>
  buttonLabel: string
  buttonDisabled?: boolean
  onButtonClick?: () => void
}) {
  return <div className={`relative ${className}`}>
    <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brown" />
    <input type="text" {...input} ref={ref} className="h-12 w-full min-w-0 rounded-xl border border-line-strong bg-cream pl-10 pr-28 text-base tracking-normal text-ink shadow-card placeholder-brown focus:border-transparent focus:outline-none focus:ring-2 focus:ring-link disabled:opacity-60 sm:text-sm" />
    <button type={onButtonClick ? 'button' : 'submit'} disabled={buttonDisabled} onClick={onButtonClick} className="btn btn-primary btn-sm absolute right-1.5 top-1/2 -translate-y-1/2">{buttonLabel}</button>
  </div>
}
