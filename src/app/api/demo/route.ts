import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobEvents } from "@/db/schema";
import { getDemoJob } from "@/lib/demo";
import { errorMessage, fail, ok } from "@/lib/api";
import { progressOf } from "@/lib/paint";
import { summarize } from "@/lib/grid";

export const dynamic = "force-dynamic";

/** The public demo loop: paints forever so the landing page is always alive. */
export async function GET() {
  try {
    const { job, pattern } = await getDemoJob();
    if (!job || !pattern) return fail("demo unavailable", 500);
    const lit = summarize(pattern.cells).lit;
    const events = await db
      .select()
      .from(jobEvents)
      .where(eq(jobEvents.jobId, job.id))
      .orderBy(desc(jobEvents.createdAt))
      .limit(14);
    return ok({
      job: {
        id: job.id,
        status: job.status,
        mode: job.mode,
        intervalSeconds: job.intervalSeconds,
        cellsPerTick: job.cellsPerTick,
        cellsPainted: job.cellsPainted,
        commitsCreated: job.commitsCreated,
        lastTickAt: job.lastTickAt,
        nextTickAt: job.nextTickAt,
        painted: job.painted,
      },
      pattern: { id: pattern.id, name: pattern.name, cells: pattern.cells },
      litCells: lit,
      progress: progressOf(job, lit),
      events: events.reverse().map((e) => ({
        id: e.id,
        level: e.level,
        message: e.message,
        createdAt: e.createdAt,
      })),
    });
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}
