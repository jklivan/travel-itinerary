'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { makeResetToken, readResetToken, resetTokenValid, RESET_LINK_MINUTES } from '@/lib/passwordReset'

export type ResetState = { message?: string; sent?: boolean } | undefined

// The site the link points to. Never taken from the request, so a forged Host header can't redirect the link.
function siteUrl() {
  if (process.env.VERCEL_ENV === 'production') return 'https://www.postcardtravel.app'
  if (process.env.VERCEL_ENV === 'preview') return 'https://postcard-travel-preview.vercel.app'
  return process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
}

const escape = (text: string) => text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)

// Forgot password: emails a reset link. Says the same thing whether or not the email has an account.
export async function requestPasswordReset(state: ResetState, formData: FormData): Promise<ResetState> {
  const email = String(formData.get('email') ?? '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return { message: 'Enter the email you signed up with.' }
  const secret = process.env.AUTH_SECRET
  if (!secret) return { message: 'Password reset isn’t available right now. Please try again later.' }
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true, name: true, email: true, password: true } })
  if (user) {
    const link = `${siteUrl()}/reset-password?token=${encodeURIComponent(makeResetToken(user.id, user.password, secret))}`
    const sent = await sendEmail({
      to: user.email,
      subject: 'Reset your Postcard password',
      text: `Hi ${user.name},\n\nTap this link to choose a new Postcard password:\n${link}\n\nIt works once, for the next ${RESET_LINK_MINUTES} minutes. If you didn’t ask for this, you can ignore this email; your password hasn’t changed.`,
      html: `<p>Hi ${escape(user.name)},</p><p>Tap the button to choose a new Postcard password.</p><p><a href="${escape(link)}" style="display:inline-block;background:#1f3354;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Choose a new password</a></p><p style="color:#6b6b6b;font-size:13px">It works once, for the next ${RESET_LINK_MINUTES} minutes. If you didn’t ask for this, you can ignore this email; your password hasn’t changed.</p>`,
    })
    if (!sent) return { message: 'We couldn’t send the email. Please try again in a few minutes.' }
  }
  return { sent: true }
}

// Reset password: checks the link, saves the new password, and sends you to sign in.
export async function resetPassword(state: ResetState, formData: FormData): Promise<ResetState> {
  const token = formData.get('token')
  const password = String(formData.get('password') ?? '')
  if (password.length < 8) return { message: 'Password must be at least 8 characters.' }
  if (password.length > 200) return { message: 'Please choose a shorter password.' }
  if (password !== formData.get('confirm')) return { message: 'The two passwords don’t match.' }
  const secret = process.env.AUTH_SECRET
  const read = readResetToken(token)
  const user = read && secret ? await prisma.user.findUnique({ where: { id: read.userId }, select: { id: true, password: true } }) : null
  if (!user || !secret || !resetTokenValid(token, user.password, secret)) return { message: 'This link has expired or was already used. Ask for a new one.' }
  // Only saves if the password hasn't changed since the link was checked, so a link can't be used twice at once.
  const saved = await prisma.user.updateMany({ where: { id: user.id, password: user.password }, data: { password: await bcrypt.hash(password, 10) } })
  if (!saved.count) return { message: 'This link has expired or was already used. Ask for a new one.' }
  redirect('/login?reset=1')
}
