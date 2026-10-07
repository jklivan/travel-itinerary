'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { signIn } from '@/auth'
import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { saveTripId } from '@/lib/saveTripReturn'

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
  await prisma.user.create({ data: { name, email, password: hashed } })

  const tripId = saveTripId(formData.get('saveTrip'))
  redirect(`/login?registered=1${tripId ? `&saveTrip=${encodeURIComponent(tripId)}` : ''}`)
}

export type LoginState = { message?: string } | undefined

// First sign-in after creating an account goes to the suggested people to follow (then on to the trip they were saving, if any).
function loginDestination(tripId: string, justRegistered: boolean) {
  if (justRegistered) return tripId ? `/welcome?saveTrip=${encodeURIComponent(tripId)}` : '/welcome'
  return tripId ? `/itinerary/${tripId}` : '/'
}

export async function login(state: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: loginDestination(saveTripId(formData.get('saveTrip')), formData.get('registered') === '1'),
    })
  } catch (e) {
    if (e instanceof AuthError) {
      return { message: 'Invalid email or password.' }
    }
    throw e
  }
}
