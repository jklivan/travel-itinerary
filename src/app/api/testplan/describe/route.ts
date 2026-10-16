import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

export const maxDuration = 60

const client = new Anthropic()

type Card = { key: string; name: string; type: string; destination: string; country: string | null; description?: string }
type Turn = { role: string; recommendations?: Card[] }

const schema = {
  type: 'object', additionalProperties: false, required: ['descriptions'],
  properties: { descriptions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'description'], properties: { key: { type: 'string' }, description: { type: 'string' } } } } },
}

// Right after the planner answers: a short description for each of its cards, written in one quick request (kept out
// of the answer so its cards arrive sooner) and saved into the conversation. Returns { key: description }.
export async function POST(request: Request) {
  const userId = (await auth())?.user?.id
  if (!userId) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  const body = await request.json().catch(() => null) as { chatId?: unknown } | null
  const chatId = typeof body?.chatId === 'string' ? body.chatId : ''
  const chat = chatId ? await prisma.planChat.findFirst({ where: { id: chatId, userId }, select: { turns: true } }) : null
  if (!chat) return Response.json({ error: 'This conversation is no longer available.' }, { status: 404 })
  const turns = chat.turns as unknown as Turn[]
  const missing = turns.flatMap(turn => turn.role === 'assistant' ? turn.recommendations ?? [] : []).filter(card => !card.description).slice(-24)
  if (!missing.length) return Response.json({ descriptions: {} })

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 6000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      system: 'You write short descriptions for place cards in Postcard, a travel app. For each place, write 2-3 sentences describing the place itself: what it is, what it\'s like, and what to order or see. Be specific and accurate; if you don\'t know a place well, describe it briefly and generally rather than inventing details. No marketing language. Return one entry per key, using the key exactly as given.',
      messages: [{ role: 'user', content: missing.map(card => `- key ${card.key}: ${card.name} (${card.type === 'food_drink' ? 'restaurant or bar' : card.type === 'hotel' ? 'place to stay' : 'thing to do'}), ${[card.destination, card.country].filter(Boolean).join(', ')}`).join('\n') }],
    })
    const text = response.content.find(block => block.type === 'text')?.text ?? ''
    const wanted = new Set(missing.map(card => card.key))
    const descriptions = Object.fromEntries((JSON.parse(text) as { descriptions: { key: string; description: string }[] }).descriptions
      .filter(entry => wanted.has(entry.key) && entry.description.trim()).map(entry => [entry.key, entry.description.trim().slice(0, 800)]))
    // Save them into the conversation as it is now (another message may have been added meanwhile).
    const latest = await prisma.planChat.findFirst({ where: { id: chatId, userId }, select: { turns: true } })
    if (latest) {
      const updated = (latest.turns as unknown as Turn[]).map(turn => turn.role === 'assistant' && turn.recommendations
        ? { ...turn, recommendations: turn.recommendations.map(card => !card.description && descriptions[card.key] ? { ...card, description: descriptions[card.key] } : card) } : turn)
      await prisma.planChat.update({ where: { id: chatId }, data: { turns: updated as unknown as Prisma.InputJsonValue } })
    }
    return Response.json({ descriptions })
  } catch (error) {
    console.error('[testplan/describe]', error instanceof Error ? error.message : error)
    return Response.json({ descriptions: {} })
  }
}
