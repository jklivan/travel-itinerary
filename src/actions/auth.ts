'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { signIn } from '@/auth'
import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'

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

  redirect('/login?registered=1')
}

export type LoginState = { message?: string } | undefined

export async function login(state: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/',
    })
  } catch (e) {
    if (e instanceof AuthError) {
      return { message: 'Invalid email or password.' }
    }
    throw e
  }
}
