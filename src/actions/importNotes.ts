'use server'

import { createHash } from 'node:crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function saveImportNotes(text: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Sign in to save your notes before importing.' }
  if (typeof text !== 'string' || !text.trim()) return { error: 'Paste your trip notes first.' }
  if (text.length > 200000) return { error: 'Please split these notes into smaller imports (up to 200,000 characters each).' }
  const userId = session.user.id
  const digest = createHash('sha256').update(text).digest('hex')
  const saved = await prisma.savedImportNotes.upsert({
    where: { userId_digest: { userId, digest } },
    create: { userId, text, digest },
    update: {},
    select: { id: true },
  })
  return { id: saved.id }
}

export async function listImportNotes() {
  const session = await auth()
  if (!session?.user?.id) return []
  const notes = await prisma.savedImportNotes.findMany({
    where: { userId: session.user.id },
    select: { id: true, text: true, createdAt: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20,
  })
  return notes.map(note => ({ id: note.id, preview: note.text.slice(0, 140), createdAt: note.createdAt.toISOString() }))
}

export async function getImportNotes(id: string) {
  const session = await auth()
  if (!session?.user?.id || typeof id !== 'string') return { error: 'Sign in to recover your notes.' }
  const saved = await prisma.savedImportNotes.findFirst({ where: { id, userId: session.user.id }, select: { text: true } })
  return saved ? { text: saved.text } : { error: 'Saved notes not found.' }
}
