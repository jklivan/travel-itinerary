import { activeStories } from '@/actions/stories'
import StoriesBar from './StoriesBar'

export default async function StoryFeed({ userId, following }: { userId: string | null; following: boolean }) {
  // Server request time gives the client a consistent hydration snapshot.
  // eslint-disable-next-line react-hooks/purity
  return <StoriesBar stories={await activeStories(following)} userId={userId} following={following} serverTime={Date.now()} />
}
