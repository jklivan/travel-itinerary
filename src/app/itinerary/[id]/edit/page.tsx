import { redirect } from 'next/navigation'

// Every trip is edited in the planner now; old links and bookmarks to this page land there.
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/plan/${id}`)
}
