'use client'

import { useState, useTransition } from 'react'
import { searchUsers, followUser, unfollowUser } from '@/actions/friends'

type User = { id: string; name: string }

export default function FriendsUI({ following }: { following: User[] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [searched, setSearched] = useState(false)
  const [followingIds, setFollowingIds] = useState<Set<string>>(
    new Set(following.map((u) => u.id))
  )
  const [, startTransition] = useTransition()

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    const res = await searchUsers(query)
    setResults(res)
    setSearched(true)
  }

  function handleFollow(userId: string) {
    startTransition(async () => {
      await followUser(userId)
      setFollowingIds((prev) => new Set([...prev, userId]))
    })
  }

  function handleUnfollow(userId: string) {
    startTransition(async () => {
      await unfollowUser(userId)
      setFollowingIds((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    })
  }

  return (
    <div className="space-y-8">
      {/* Search */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Find travellers</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSearched(false) }}
            placeholder="Search by name…"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="submit"
            className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
            Search
          </button>
        </form>

        {searched && results.length === 0 && (
          <p className="mt-4 text-sm text-gray-400 italic">No users found.</p>
        )}

        {results.length > 0 && (
          <ul className="mt-4 divide-y divide-gray-100">
            {results.map((user) => (
              <li key={user.id} className="flex items-center justify-between py-3">
                <span className="text-sm font-medium text-gray-800">{user.name}</span>
                {followingIds.has(user.id) ? (
                  <button onClick={() => handleUnfollow(user.id)}
                    className="text-xs font-medium px-3 py-1 rounded-full border border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors">
                    Following
                  </button>
                ) : (
                  <button onClick={() => handleFollow(user.id)}
                    className="text-xs font-medium px-3 py-1 rounded-full border border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors">
                    + Follow
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Following list */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">
          People you follow
          {followingIds.size > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-400">({followingIds.size})</span>
          )}
        </h2>
        {followingIds.size === 0 ? (
          <p className="text-sm text-gray-400 italic">You&apos;re not following anyone yet. Search above to find travellers.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {following.filter((u) => followingIds.has(u.id)).map((user) => (
              <li key={user.id} className="flex items-center justify-between py-3">
                <span className="text-sm font-medium text-gray-800">{user.name}</span>
                <button onClick={() => handleUnfollow(user.id)}
                  className="text-xs font-medium px-3 py-1 rounded-full border border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors">
                  Unfollow
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
