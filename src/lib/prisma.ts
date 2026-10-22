import { PrismaClient } from '@/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof createPrisma> }

function createPrisma() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
  // A place's private booking details are left out of every query unless one asks for them (omit: { bookingDetails:
  // false }), so they can't reach other people's screens by accident.
  return new PrismaClient({ adapter, omit: { destItem: { bookingDetails: true } } })
}

export const prisma = globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
