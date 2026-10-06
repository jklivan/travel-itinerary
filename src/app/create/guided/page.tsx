import { redirect } from 'next/navigation'

// The old trip-creation pages are gone; new trips start in the planner. Old links and bookmarks land there.
export default function CreatePage() { redirect('/plan') }
