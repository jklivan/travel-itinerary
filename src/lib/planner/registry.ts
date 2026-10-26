import type Anthropic from '@anthropic-ai/sdk'
import { friendsPlaces, searchPlacesTool, placeDetailsTool, openingHoursTool, travelTimeTool } from './tools/places'
import { weatherTool, localEventsTool, toursTool, hotelPrices } from './tools/conditions'
import { listTrips, getTrip, addPlaces } from './tools/trips'
import { fail, type PlannerTool, type ToolContext, type ToolResult } from './types'

// Every tool the trip planner agent can use, in one place. The chat route picks which to offer (all read-only ones
// by default; writing ones once there's a confirm step).
export const PLANNER_TOOLS: PlannerTool[] = [
  friendsPlaces, searchPlacesTool, placeDetailsTool, openingHoursTool, travelTimeTool,
  hotelPrices, toursTool, weatherTool, localEventsTool,
  listTrips, getTrip, addPlaces,
]
const byName = new Map(PLANNER_TOOLS.map(tool => [tool.name, tool]))

// The tools in the form the Claude API takes.
export function anthropicTools(options: { writes?: boolean; only?: string[] } = {}): Anthropic.Tool[] {
  return PLANNER_TOOLS.filter(tool => (options.writes || !tool.writes) && (!options.only || options.only.includes(tool.name)))
    .map(tool => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema as Anthropic.Tool.InputSchema }))
}

// Runs one tool call from the AI: checks it exists and its required fields are there, times it out, and turns any
// failure into a short message the AI can read (so one broken service doesn't end the answer).
export async function runPlannerTool(name: string, input: unknown, context: ToolContext, options: { writes?: boolean; timeoutMs?: number } = {}): Promise<ToolResult & { ms: number }> {
  const started = Date.now()
  const tool = byName.get(name)
  const done = (result: ToolResult) => ({ ...result, ms: Date.now() - started })
  if (!tool) return done(fail(`There is no tool called ${name}.`))
  if (tool.writes && !options.writes) return done(fail(`${name} changes the traveler’s trip and needs their OK first.`))
  const args = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {}
  const missing = (tool.inputSchema.required ?? []).filter(field => args[field] === undefined || args[field] === '')
  if (missing.length) return done(fail(`Missing ${missing.join(', ')}.`))
  const signal = AbortSignal.any([AbortSignal.timeout(options.timeoutMs ?? 20_000), ...(context.signal ? [context.signal] : [])])
  try { return done(await tool.run(args, { ...context, signal })) }
  catch (error) {
    console.error('[planner tool]', name, error instanceof Error ? error.message : error)
    return done(fail(`${name} isn’t working right now${error instanceof Error && error.message ? ` (${error.message})` : ''}. Answer without it.`))
  }
}
