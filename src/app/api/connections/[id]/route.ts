import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections, jobEvents, jobs } from "@/db/schema";
import { errorMessage, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const owned = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.connectionId, id));
    for (const j of owned) await db.delete(jobEvents).where(eq(jobEvents.jobId, j.id));
    await db.delete(jobs).where(eq(jobs.connectionId, id));
    await db.delete(connections).where(eq(connections.id, id));
    return ok({ deleted: id });
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}
