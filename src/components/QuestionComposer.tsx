'use client'

import { useRef, useState, useTransition } from 'react'
import SearchField from '@/components/ui/SearchField'
import { useRouter } from 'next/navigation'
import { createFriendQuestion, replyToFriendQuestion, searchQuestionItineraries } from '@/actions/questions'
import MessageAttachment from './MessageAttachment'

type Trip = Awaited<ReturnType<typeof searchQuestionItineraries>>[number]

export default function QuestionComposer({ questionId }: { questionId?: string }) {
  const [content, setContent] = useState('')
  const [trip, setTrip] = useState<Trip>()
  const [showPicker, setShowPicker] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Trip[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const [searching, startSearch] = useTransition()
  const clientId = useRef<string | null>(null)
  const router = useRouter()

  function searchTrips() {
    if (pending || searching || query.trim().length < 2) return
    setError('')
    startSearch(async () => {
      try { setResults(await searchQuestionItineraries(query)); setSearched(true) }
      catch { setError('Could not search itineraries. Please try again.') }
    })
  }

  return <form className="panel space-y-3 p-5" onSubmit={event => {
    event.preventDefault()
    if (pending) return
    setError('')
    clientId.current ??= crypto.randomUUID()
    startTransition(async () => {
      try {
        const input = { content, clientId: clientId.current!, itineraryId: trip?.id }
        const result = questionId ? await replyToFriendQuestion(questionId, input) : await createFriendQuestion(input)
        if (result.error) { setError(result.error); return }
        setContent(''); setTrip(undefined); setShowPicker(false); setQuery(''); setResults([]); setSearched(false); clientId.current = null
        router.push(`/explore/questions/${questionId || result.id}`, { scroll: !questionId })
        router.refresh()
      } catch { setError('Could not post. Your text is still here—please try again.') }
    })
  }}>
    <label className="block text-sm font-semibold text-ink">{questionId ? 'Your reply' : 'What would you like to ask?'}
      <textarea required maxLength={4000} rows={3} disabled={pending} value={content} onChange={event => { setContent(event.target.value); clientId.current = null }} placeholder={questionId ? 'Share your advice or recommend a trip…' : 'Any favorite places to stay in Portugal with kids?'} className="field mt-2" />
    </label>
    {trip ? <div className="space-y-2">
      <MessageAttachment kind="trip" name={trip.title} trip={`By ${trip.user.name}`} href={`/itinerary/${trip.id}`} />
      <button type="button" disabled={pending} onClick={() => { setTrip(undefined); clientId.current = null }} className="text-xs text-brown underline">Remove itinerary</button>
    </div> : <button type="button" disabled={pending} onClick={() => setShowPicker(!showPicker)} className="text-sm font-medium text-link underline">{showPicker ? 'Cancel itinerary search' : '+ Tag an itinerary'}</button>}
    {showPicker && !trip && <div className="panel-inset space-y-2 p-3">
      <label className="block text-xs font-medium text-brown">Find an itinerary by title or paste its link
        <SearchField className="mt-1" value={query} disabled={pending || searching} onChange={event => { setQuery(event.target.value); setSearched(false); setResults([]) }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); searchTrips() } }} maxLength={300}
          buttonLabel={searching ? 'Searching…' : 'Search'} buttonDisabled={pending || searching || query.trim().length < 2} onButtonClick={searchTrips} />
      </label>
      {searched && results.length === 0 && <p role="status" className="text-sm text-brown">No itineraries found. Try another title or paste a trip link.</p>}
      <ul className="space-y-1">{results.map(result => <li key={result.id}><button type="button" disabled={pending} className="w-full rounded-lg p-2 text-left hover:bg-mist" onClick={() => { setTrip(result); setShowPicker(false); clientId.current = null }}><span className="block text-sm font-medium text-ink">{result.title}</span><span className="text-xs text-brown">By {result.user.name}</span></button></li>)}</ul>
    </div>}
    <p className="text-xs leading-relaxed text-brown">{questionId ? 'Your reply is visible to everyone who can see this question.' : 'Visible to you and the people you follow. They can read and reply to the whole discussion.'}</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <button disabled={pending || searching || !content.trim()} className="btn btn-primary btn-sm">{pending ? 'Posting…' : questionId ? 'Post reply' : 'Ask your friends'}</button>
  </form>
}
