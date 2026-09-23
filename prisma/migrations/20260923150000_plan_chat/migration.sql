-- CreateTable
CREATE TABLE "PlanChat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripId" TEXT,
    "history" JSONB NOT NULL DEFAULT '[]',
    "turns" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanChat_userId_tripId_updatedAt_idx" ON "PlanChat"("userId", "tripId", "updatedAt");

-- AddForeignKey
ALTER TABLE "PlanChat" ADD CONSTRAINT "PlanChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanChat" ADD CONSTRAINT "PlanChat_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Itinerary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

