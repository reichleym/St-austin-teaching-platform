import { NextResponse } from "next/server";
import { PermissionError, requireSuperAdminUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function ensureHistorySchema() {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "GradeHistory" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "submissionId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "oldRawScore" DOUBLE PRECISION,
  "newRawScore" DOUBLE PRECISION,
  "oldFinalScore" DOUBLE PRECISION,
  "newFinalScore" DOUBLE PRECISION,
  "oldState" TEXT,
  "newState" TEXT,
  "reason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GradeHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GradeHistory_assignment_student_idx" ON "GradeHistory"("assignmentId","studentId","createdAt");
`);
}

export async function GET() {
  try {
    await ensureHistorySchema();
    await requireSuperAdminUser();

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        assignmentId: string;
        studentId: string;
        submissionId: string | null;
        actorId: string | null;
        action: string;
        oldRawScore: number | null;
        newRawScore: number | null;
        oldFinalScore: number | null;
        newFinalScore: number | null;
        oldState: string | null;
        newState: string | null;
        reason: string | null;
        metadata: unknown;
        createdAt: Date;
      }>
    >`
      SELECT *
      FROM "GradeHistory"
      ORDER BY "createdAt" DESC
      LIMIT 500
    `;

    return NextResponse.json({
      entries: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load grade history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
