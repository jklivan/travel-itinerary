'use client'

import FollowButton from './FollowButton'

// "Follow back" for someone who follows you; becomes "Following" (tap again to unfollow).
export default function FollowBackButton({ userId, name, initialFollowing }: { userId: string; name: string; initialFollowing: boolean }) {
  return <FollowButton userId={userId} name={name} initialStatus={initialFollowing} followsYou />
}
