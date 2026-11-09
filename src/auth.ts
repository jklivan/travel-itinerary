import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import Apple from 'next-auth/providers/apple'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { followSuggestedPeople } from '@/lib/suggestedPeople'
import { appleClientSecret } from '@/lib/appleSecret'
import { verifyNativeIdToken } from '@/lib/nativeSignIn'

const appleSecret = appleClientSecret()

// The account for an email from Google or Apple: an existing one (whatever its capitals), else a new one, which starts
// out following the most active travelers like an email sign-up.
async function accountForEmail(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
    ?? await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, orderBy: { createdAt: 'asc' } })
  if (existing) return existing
  const created = await prisma.user.create({ data: { email, name: name.trim().slice(0, 80) || email.split('@')[0] } })
  await followSuggestedPeople(created.id).catch(error => console.error('[auth] suggested follows failed', error))
  return created
}

// Apple posts its answer back from appleid.apple.com, so the cookies that check it must be sent cross-site.
const crossSite = { httpOnly: true, sameSite: 'none' as const, path: '/', secure: true }

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null
        const email = String(credentials.email).trim()
        // Email capitals don't matter (older accounts kept the capitals they were made with); an exact match wins.
        const user = await prisma.user.findUnique({ where: { email } })
          ?? await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, orderBy: { createdAt: 'asc' } })
        if (!user?.password) return null
        const valid = await bcrypt.compare(credentials.password as string, user.password)
        if (!valid) return null
        return { id: user.id, email: user.email, name: user.name }
      },
    }),
    // Inside the iPhone app: Apple or Google sign-in done natively, its ID token checked here (lib/nativeSignIn).
    Credentials({
      id: 'native',
      credentials: { provider: {}, idToken: {}, name: {} },
      authorize: async (credentials) => {
        const verified = await verifyNativeIdToken(String(credentials?.provider ?? ''), credentials?.idToken)
        if (!verified) return null
        const given = typeof credentials?.name === 'string' ? credentials.name.trim().slice(0, 80) : ''
        const user = await accountForEmail(verified.email, given || verified.name || verified.email.split('@')[0])
        return { id: user.id, email: user.email, name: user.name }
      },
    }),
    // Each shows up once its keys are set (AUTH_GOOGLE_ID/SECRET; Apple's from lib/appleSecret). Sign-in only: name and email.
    ...(process.env.AUTH_GOOGLE_ID ? [Google] : []),
    ...(appleSecret ? [Apple({ clientId: process.env.AUTH_APPLE_ID!.trim(), clientSecret: appleSecret })] : []),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  // After signing in or out, stay on the address you're using (www.postcardtravel.app, or the app's own address).
  trustHost: true,
  session: { strategy: 'jwt' },
  ...(process.env.VERCEL && {
    cookies: {
      state: { name: '__Secure-authjs.state', options: { ...crossSite, maxAge: 900 } },
      nonce: { name: '__Secure-authjs.nonce', options: crossSite },
    },
  }),
  callbacks: {
    signIn({ account, profile }) {
      // Google and Apple accounts join an existing Postcard account with the same email, so the email must be verified.
      if (account?.provider === 'google' || account?.provider === 'apple') {
        // Apple sends email_verified as "true"/"false" strings.
        return !!profile?.email && String(profile.email_verified) === 'true'
      }
      return true
    },
    async jwt({ token, user, account, profile }) {
      if (account && account.provider !== 'credentials' && profile?.email) {
        const email = profile.email.toLowerCase()
        // Apple only sends a name the first time; fall back to the start of the email.
        const name = (user?.name && user.name !== profile.email ? user.name : email.split('@')[0]).trim().slice(0, 80)
        const found = await accountForEmail(email, name)
        token.id = found.id
        token.name = found.name
        token.email = found.email
      } else if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string
      return session
    },
  },
})
