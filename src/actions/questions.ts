'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { questionAudience } from '@/lib/friendQuestions'
import { revalidatePath } from 'next/cache'

type QuestionInput = { content: string; clientId: string; itineraryId?: string }
const authorSelect = { id: true, name: true } as const

function validate(input: QuestionInput) {
  if (!input || typeof input.content !== 'string' || !input.content.trim() || input.content.trim().length > 4000) return 'Write up to 4,000 characters.'
  if (typeof input.clientId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(input.clientId)) return 'Please try again.'
  if (input.itineraryId !== undefined && typeof input.itineraryId !== 'string') return 'Choose an available itinerary.'
}

async function tripAttachment(itineraryId?: string) {
  if (!itineraryId) return {}
  const trip = await prisma.itinerary.findFirst({ where: { id: itineraryId, visibility: { not: 'draft' } }, select: { id: true, title: true } })
  return trip ? { itineraryId: trip.id, itineraryTitle: trip.title } : null
}

export async function getFriendQuestions(before?: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Sign in to see questions from friends.' }
  const audience = questionAudience(session.user.id)
  if (before && !await prisma.friendQuestion.findFirst({ where: { id: before, ...audience }, select: { id: true } })) return { error: 'Question not found.' }
  const questions = await prisma.friendQuestion.findMany({
    where: audience, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21,
    ...(before ? { cursor: { id: before }, skip: 1 } : {}),
    include: { author: { select: authorSelect }, _count: { select: { replies: true } } },
  })
  return { questions: questions.slice(0, 20), hasMore: questions.length > 20 }
}

export async function getFriendQuestion(id: string, before?: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Sign in to see this question.' }
  const question = await prisma.friendQuestion.findFirst({ where: { id, ...questionAudience(session.user.id) }, include: { author: { select: authorSelect } } })
  if (!question) return { error: 'Question not found.' }
  if (before && !await prisma.friendQuestionReply.findFirst({ where: { id: before, questionId: id }, select: { id: true } })) return { error: 'Reply not found.' }
  const replies = await prisma.friendQuestionReply.findMany({
    where: { questionId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 51,
    ...(before ? { cursor: { id: before }, skip: 1 } : {}),
    include: { author: { select: authorSelect } },
  })
  return { question, replies: replies.slice(0, 50).reverse(), hasOlder: replies.length > 50 }
}

export async function createFriendQuestion(input: QuestionInput) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Sign in to ask your friends.' }
  const error = validate(input)
  if (error) return { error }
  const attachment = await tripAttachment(input.itineraryId)
  if (!attachment) return { error: 'This itinerary is no longer available. Remove it or choose another.' }
  const question = await prisma.friendQuestion.upsert({
    where: { authorId_clientId: { authorId: session.user.id, clientId: input.clientId } }, update: {},
    create: { authorId: session.user.id, content: input.content.trim(), clientId: input.clientId, ...attachment },
  })
  revalidatePath('/explore/questions')
  return { id: question.id }
}

export async function replyToFriendQuestion(questionId: string, input: QuestionInput) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Sign in to reply.' }
  const error = validate(input)
  if (error) return { error }
  const question = await prisma.friendQuestion.findFirst({ where: { id: questionId, ...questionAudience(session.user.id) }, select: { id: true } })
  if (!question) return { error: 'This question is no longer available to you.' }
  const attachment = await tripAttachment(input.itineraryId)
  if (!attachment) return { error: 'This itinerary is no longer available. Remove it or choose another.' }
  const reply = await prisma.friendQuestionReply.upsert({
    where: { authorId_clientId: { authorId: session.user.id, clientId: input.clientId } }, update: {},
    create: { questionId, authorId: session.user.id, content: input.content.trim(), clientId: input.clientId, ...attachment },
  })
  revalidatePath('/explore/questions')
  revalidatePath(`/explore/questions/${questionId}`)
  return { id: reply.id }
}

export async function searchQuestionItineraries(query: string) {
  const session = await auth()
  if (!session?.user?.id || typeof query !== 'string' || query.trim().length < 2 || query.length > 300) return []
  const search = query.trim()
  const linkedId = search.match(/\/itinerary\/([^/?#]+)/)?.[1]
  return prisma.itinerary.findMany({
    where: { visibility: { not: 'draft' }, ...(linkedId ? { id: linkedId } : { title: { contains: search, mode: 'insensitive' as const } }) },
    select: { id: true, title: true, user: { select: { name: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 10,
  })
}
