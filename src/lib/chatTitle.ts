import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

const client = new Anthropic()
type StoredTurn = { role: string; text?: string; title?: string; summary?: string }

// Names a past AI planner conversation (title + one-line summary) for the Past chats list. Used for
// chats from before the planner named them itself; the result is saved on the latest reply, so this
// only ever runs once per chat. Returns null if it can't (the list then shows the old topic).
export async function nameChat(id: string, turns: StoredTurn[], updatedAt: Date): Promise<{ title: string; summary: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const lastReply = turns.findLastIndex(turn => turn.role === 'assistant')
  if (lastReply < 0) return null
  const transcript = turns.filter(turn => (turn.role === 'user' || turn.role === 'assistant') && turn.text)
    .map(turn => `${turn.role === 'user' ? 'Traveler' : 'Planner'}: ${turn.text!.slice(0, 600)}`).join('\n').slice(-6000)
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      tools: [{ name: 'name_chat', description: 'Name a travel-planning conversation.', input_schema: { type: 'object' as const, properties: {
        title: { type: 'string', description: 'Short, evocative title for the whole conversation, 2-5 words, no quotes or emoji, e.g. "Amalfi coast honeymoon".' },
        summary: { type: 'string', description: 'One plain sentence, at most 15 words, on what was discussed or decided.' },
      }, required: ['title', 'summary'] } }],
      tool_choice: { type: 'tool', name: 'name_chat' },
      messages: [{ role: 'user', content: `<conversation>\n${transcript}\n</conversation>` }],
    })
    const block = message.content.find(item => item.type === 'tool_use')
    if (!block || block.type !== 'tool_use') return null
    const input = block.input as { title?: string; summary?: string }
    const title = (input.title ?? '').trim().slice(0, 60)
    const summary = (input.summary ?? '').trim().slice(0, 160)
    if (!title) return null
    const next = turns.map((turn, index) => index === lastReply ? { ...turn, title, summary } : turn)
    // Only if the chat hasn't changed meanwhile (a new reply names itself). Naming it isn't activity,
    // so it keeps its date and its place in the list.
    await prisma.planChat.updateMany({ where: { id, turns: { equals: turns as unknown as Prisma.InputJsonValue } }, data: { turns: next as unknown as Prisma.InputJsonValue, updatedAt } })
    return { title, summary }
  } catch { return null }
}
