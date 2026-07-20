import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { notFound, redirect } from 'next/navigation'
import EditForm from './EditForm'

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const it = await prisma.itinerary.findUnique({
    where: { id },
    include: {
      destinations: {
        orderBy: { order: 'asc' },
        include: { items: true },
      },
      photos: true,
    },
  })

  if (!it || it.userId !== session.user.id) notFound()

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {it.postType === 'guide' ? 'Edit Guide' : 'Edit Itinerary'}
      </h1>
      <EditForm itinerary={it} />
    </div>
  )
}
