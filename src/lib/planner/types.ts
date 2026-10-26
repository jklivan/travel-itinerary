// The trip planner agent's tools: each has a name and a description the AI reads, a JSON schema for its input, and
// the code that runs it. Read-only tools can run whenever the AI likes; tools that change a trip are marked so the
// agent (or the person) can confirm first.
export type ToolContext = {
  userId: string
  // The trip being planned, when there is one (its places and dates are fair game).
  tripId?: string | null
  // Postcard's own address, for links in results.
  origin: string
  signal?: AbortSignal
}

export type ToolResult = { content: string; isError?: boolean }

export type JsonSchema = { type: 'object'; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean }

export type PlannerTool = {
  name: string
  description: string
  inputSchema: JsonSchema
  // Changes the person's trips (needs a confirm step before the agent uses it on its own).
  writes?: boolean
  run: (input: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>
}

export const ok = (data: unknown): ToolResult => ({ content: typeof data === 'string' ? data : JSON.stringify(data) })
export const fail = (message: string): ToolResult => ({ content: message, isError: true })

// Small input helpers: tools get JSON from the AI, so every field is checked before use.
export const text = (value: unknown, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : ''
export const int = (value: unknown, min: number, max: number) => Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? value as number : null
export const isoDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : null
export const hhmm = (value: unknown) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null
