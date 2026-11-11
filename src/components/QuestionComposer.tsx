'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createFriendQuestion, myQuestionTrips, replyToFriendQuestion } from '@/actions/questions'
import MessageAttachment from './MessageAttachment'

type Trip = Awaited<ReturnType<typeof myQuestionTrips>>[number]

export default function QuestionComposer({ questionId }: { questionId?: string }) {
  const [content, setContent] = useState('')
  const [trip, setTrip] = useState<Trip>()
  const [showPicker, setShowPicker] = useState(false)
  // Your trips to choose from (loaded the first time the list is opened).
  const [trips, setTrips] = useState<Trip[] | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const clientId = useRef<string | null>(null)
  const loading = useRef(false)
  const router = useRouter()
  function openPicker() {
    setShowPicker(value => !value)
    if (trips === null && !loading.current) { loading.current = true; void myQuestionTrips().then(setTrips, () => { loading.current = false; setError('Could not load your trips. Please try again.') }) }
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
        setContent(''); setTrip(undefined); setShowPicker(false); clientId.current = null
        router.push(`/explore/questions/${questionId || result.id}`, { scroll: !questionId })
        router.refresh()
      } catch { setError('Could not post. Your text is still here—please try again.') }
    })
  }}>
    <label className="block text-sm font-semibold text-ink">{questionId ? 'Your reply' : 'What would you like to ask?'}
      <textarea required maxLength={4000} rows={3} disabled={pending} value={content} onChange={event => { setContent(event.target.value); clientId.current = null }} placeholder={questionId ? 'Share your advice or recommend a trip…' : 'Any favorite places to stay in Portugal with kids?'} className="field mt-2" />
    </label>
    {trip ? <div className="space-y-2">
      <MessageAttachment kind="trip" name={trip.title} trip={trip.visibility === 'draft' ? 'Private plan: friends can view it from here' : 'Your trip'} href={`/plan/${trip.id}`} />
      <button type="button" disabled={pending} onClick={() => { setTrip(undefined); clientId.current = null }} className="text-xs text-brown underline">Remove itinerary</button>
    </div> : <button type="button" disabled={pending} onClick={openPicker} className="text-sm font-medium text-link underline">{showPicker ? 'Cancel' : '+ Add one of your trips'}</button>}
    {showPicker && !trip && <label className="block text-xs font-medium text-brown">Which trip?
      <select value="" disabled={pending || !trips?.length} onChange={event => { const chosen = trips?.find(option => option.id === event.target.value); if (chosen) { setTrip(chosen); setShowPicker(false); clientId.current = null } }} className="field mt-1">
        <option value="">{trips === null ? 'Loading your trips…' : trips.length ? 'Choose a trip' : 'You don’t have any trips yet'}</option>
        {!!trips?.some(option => option.visibility === 'draft') && <optgroup label="Planning">{trips.filter(option => option.visibility === 'draft').map(option => <option key={option.id} value={option.id}>{option.title || 'Untitled trip'}</option>)}</optgroup>}
        {!!trips?.some(option => option.visibility !== 'draft') && <optgroup label="Posted">{trips.filter(option => option.visibility !== 'draft').map(option => <option key={option.id} value={option.id}>{option.title || 'Untitled trip'}</option>)}</optgroup>}
      </select></label>}
    <p className="text-xs leading-relaxed text-brown">{questionId ? 'Your reply is visible to everyone who can see this question.' : 'Visible to you and the people you follow. They can read and reply to the whole discussion.'}</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <button disabled={pending || !content.trim()} className="btn btn-primary btn-sm">{pending ? 'Posting…' : questionId ? 'Post reply' : 'Ask your friends'}</button>
  </form>
}
