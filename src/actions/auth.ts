'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { signIn } from '@/auth'
import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { oauthReturn, saveTripId } from '@/lib/saveTripReturn'
import { followSuggestedPeople } from '@/lib/suggestedPeople'

type FieldErrors = { name?: string[]; email?: string[]; password?: string[] }

export type RegisterState = {
  errors?: FieldErrors
  message?: string
} | undefined

export async function register(state: RegisterState, formData: FormData): Promise<RegisterState> {
  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string

  const errors: FieldErrors = {}
  if (!name || name.length < 2) errors.name = ['Name must be at least 2 characters.']
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = ['Valid email required.']
  if (!password || password.length < 8) errors.password = ['Password must be at least 8 characters.']

  if (Object.keys(errors).length > 0) return { errors }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { errors: { email: ['An account with this email already exists.'] } }

  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({ data: { name, email, password: hashed }, select: { id: true } })
  // Start out following the most active travelers (shown on the welcome page, where they can unfollow).
  await followSuggestedPeople(user.id).catch(error => console.error('[register] suggested follows failed', error))

  const tripId = saveTripId(formData.get('saveTrip'))
  redirect(`/login?registered=1${tripId ? `&saveTrip=${encodeURIComponent(tripId)}` : ''}`)
}

export type LoginState = { message?: string } | undefined

// First sign-in after creating an account goes to the intro slides, then the suggested people to follow (then on
// to the trip they were saving, if any).
function loginDestination(tripId: string, justRegistered: boolean) {
  if (justRegistered) return tripId ? `/welcome/intro?saveTrip=${encodeURIComponent(tripId)}` : '/welcome/intro'
  return tripId ? `/itinerary/${tripId}` : '/'
}

export async function login(state: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: oauthReturn(formData.get('next')) || loginDestination(saveTripId(formData.get('saveTrip')), formData.get('registered') === '1'),
    })
  } catch (e) {
    if (e instanceof AuthError) {
      return { message: 'Invalid email or password.' }
    }
    throw e
  }
}

export async function socialSignIn(formData: FormData) {
  const provider = formData.get('provider')
  if (provider !== 'google' && provider !== 'apple') return
  const tripId = saveTripId(formData.get('saveTrip'))
  // Then /welcome/continue: the intro for a brand-new account, otherwise the trip they were saving or the Feed.
  await signIn(provider, { redirectTo: `/welcome/continue${tripId ? `?saveTrip=${encodeURIComponent(tripId)}` : ''}` })
}

// Inside the iPhone app: the ID token from native Apple or Google sign-in (checked in auth.ts), then on like socialSignIn.
export async function nativeSignIn(provider: 'apple' | 'google', idToken: string, name: string, tripId: string): Promise<{ error?: string }> {
  try {
    const trip = saveTripId(tripId)
    await signIn('native', { provider, idToken, name, redirectTo: `/welcome/continue${trip ? `?saveTrip=${encodeURIComponent(trip)}` : ''}` })
  } catch (e) {
    if (e instanceof AuthError) return { error: 'That sign-in didn’t go through. Try again, or sign in with your email.' }
    throw e
  }
  return {}
}
