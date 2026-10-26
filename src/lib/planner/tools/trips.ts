import { TOOLS as CONNECTOR_TOOLS, callTool } from '@/lib/mcpTools'
import { fail, type PlannerTool } from '../types'

// The traveler's own trips: read them, and add places to a private plan. Shared with the assistant connector
// (lib/mcpTools), so both behave the same.
function fromConnector(name: string, overrides: Partial<PlannerTool> = {}): PlannerTool {
  const tool = CONNECTOR_TOOLS.find(candidate => candidate.name === name)
  if (!tool) throw new Error(`Unknown connector tool ${name}`)
  return {
    name, description: tool.description, inputSchema: tool.inputSchema as PlannerTool['inputSchema'],
    async run(input, { userId, origin }) { const result = await callTool(name, input, userId, origin); return result.error ? fail(result.text) : { content: result.text } },
    ...overrides,
  }
}

export const listTrips = fromConnector('list_trips')
export const getTrip = fromConnector('get_trip')
export const addPlaces = fromConnector('add_places', { writes: true })
