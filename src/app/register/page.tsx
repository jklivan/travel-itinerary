'use client'

import { useActionState } from 'react'
import { register } from '@/actions/auth'
import Link from 'next/link'

export default function RegisterPage() {
  const [state, action, pending] = useActionState(register, undefined)

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-[#2C1810]">Create an account</h1>
          <p className="text-sm text-[#8B6F4E] mt-1">Start sharing your travel adventures</p>
        </div>

        <div className="bg-[#FAF7F2] rounded-2xl border border-[#E8D5B7] p-6">
          <form action={action} className="space-y-4">
            {state?.message && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {state.message}
              </p>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[#5C3D2E] mb-1">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                className="w-full rounded-lg border border-[#C4A882] px-4 py-2.5 text-sm text-[#2C1810] bg-white focus:outline-none focus:ring-2 focus:ring-[#8B6F4E] focus:border-transparent"
                placeholder="Jane Smith"
              />
              {state?.errors?.name && (
                <p className="text-xs text-red-500 mt-1">{state.errors.name[0]}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#5C3D2E] mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-lg border border-[#C4A882] px-4 py-2.5 text-sm text-[#2C1810] bg-white focus:outline-none focus:ring-2 focus:ring-[#8B6F4E] focus:border-transparent"
                placeholder="you@example.com"
              />
              {state?.errors?.email && (
                <p className="text-xs text-red-500 mt-1">{state.errors.email[0]}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#5C3D2E] mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="w-full rounded-lg border border-[#C4A882] px-4 py-2.5 text-sm text-[#2C1810] bg-white focus:outline-none focus:ring-2 focus:ring-[#8B6F4E] focus:border-transparent"
                placeholder="Min. 8 characters"
              />
              {state?.errors?.password && (
                <p className="text-xs text-red-500 mt-1">{state.errors.password[0]}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-[#2C1810] text-white font-medium py-2.5 rounded-lg hover:bg-[#5C3D2E] transition-colors disabled:opacity-60"
            >
              {pending ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#8B6F4E] mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-[#5C3D2E] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
