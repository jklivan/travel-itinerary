'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { questionAudience } from '@/lib/friendQuestions'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createForumNotifications } from '@/lib/notifications'
import { deliverNotification } from '@/lib/push'

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
  const authorId = session.user.id
  const error = validate(input)
  if (error) return { error }
  const attachment = await tripAttachment(input.itineraryId)
  if (!attachment) return { error: 'This itinerary is no longer available. Remove it or choose another.' }
  const { question, notifications } = await prisma.$transaction(async tx => {
    const question = await tx.friendQuestion.upsert({
      where: { authorId_clientId: { authorId, clientId: input.clientId } }, update: {},
      create: { authorId, content: input.content.trim(), clientId: input.clientId, ...attachment },
    })
    const notifications = await createForumNotifications(tx, question.id, question.authorId)
    return { question, notifications }
  })
  if (notifications.length) after(async () => {
    for (let offset = 0; offset < notifications.length; offset += 10) {
      await Promise.allSettled(notifications.slice(offset, offset + 10).map(row => deliverNotification(row.id)))
    }
  })
  revalidatePath('/notifications')
  revalidatePath('/explore/questions')
  return { id: question.id }
}

export async function replyToFriendQuestion(questionId: string, input: QuestionInput) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Sign in to reply.' }
  const error = validate(input)
  if (error) return { error }
  const question = await prisma.friendQuestion.findFirst({ where: { id: questionId, ...questionAudience(session.user.id) }, select: { id: true, authorId: true } })
  if (!question) return { error: 'This question is no longer available to you.' }
  const attachment = await tripAttachment(input.itineraryId)
  if (!attachment) return { error: 'This itinerary is no longer available. Remove it or choose another.' }
  const authorId = session.user.id
  const { reply, notificationId } = await prisma.$transaction(async tx => {
    const reply = await tx.friendQuestionReply.upsert({
      where: { authorId_clientId: { authorId, clientId: input.clientId } }, update: {},
      create: { questionId, authorId, content: input.content.trim(), clientId: input.clientId, ...attachment },
    })
    if (reply.questionId !== questionId) throw new Error('Reply retry belongs to another question')
    const notifications = question.authorId === authorId ? [] : await tx.notification.createManyAndReturn({
      data: [{ recipientId: question.authorId, actorId: authorId, questionId, questionReplyId: reply.id, kind: 'forum_reply', dedupeKey: `forum-reply:${reply.id}` }],
      skipDuplicates: true, select: { id: true },
    })
    return { reply, notificationId: notifications[0]?.id }
  })
  if (notificationId) after(() => deliverNotification(notificationId))
  revalidatePath('/messages')
  revalidatePath('/notifications')
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

export async function getForumReplyInbox() {
  const userId = (await auth())?.user?.id
  if (!userId) return []
  return prisma.friendQuestionReply.findMany({
    where: { question: { authorId: userId }, authorId: { not: userId } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50,
    include: { question: { select: { id: true, content: true } }, author: { select: { name: true } }, notification: { select: { id: true, readAt: true } } },
  })
}
