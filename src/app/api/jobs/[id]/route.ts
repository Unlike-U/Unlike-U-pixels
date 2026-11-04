import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobEvents, jobs, patterns } from "@/db/schema";
import { clampInt, errorMessage, fail, ok } from "@/lib/api";
import { logEvent, progressOf, tickJob } from "@/lib/paint";
import { summarize } from "@/lib/grid";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function loadJob(id: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!job) return null;
  const [pattern] = await db.select().from(patterns).where(eq(patterns.id, job.patternId)).limit(1);
  const lit = pattern ? summarize(pattern.cells).lit : 0;
  return { job, pattern, lit };
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const loaded = await loadJob(id);
    if (!loaded) return fail("job not found", 404);
    const events = await db
      .select()
      .from(jobEvents)
      .where(eq(jobEvents.jobId, id))
      .orderBy(desc(jobEvents.createdAt))
      .limit(120);
    return ok({
      job: { ...loaded.job, patternName: loaded.pattern?.name ?? null, litCells: loaded.lit },
      pattern: loaded.pattern,
      progress: progressOf(loaded.job, loaded.lit),
      events: events.reverse(),
    });
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const loaded = await loadJob(id);
  if (!loaded) return fail("job not found", 404);
  const { job } = loaded;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") patch.name = body.name.slice(0, 80);
  if (typeof body.repo === "string" && body.repo.trim()) patch.repo = body.repo.trim();
  if (typeof body.branch === "string" && body.branch.trim()) patch.branch = body.branch.trim();
  if (typeof body.commitPath === "string" && body.commitPath.trim()) patch.commitPath = body.commitPath.trim();
  if (typeof body.commitMessage === "string" && body.commitMessage.trim())
    patch.commitMessage = body.commitMessage.slice(0, 140);
  if (body.intervalSeconds !== undefined)
    patch.intervalSeconds = clampInt(body.intervalSeconds, job.mode === "github" ? 30 : 3, 86400, job.intervalSeconds);
  if (body.cellsPerTick !== undefined) patch.cellsPerTick = clampInt(body.cellsPerTick, 1, 80, job.cellsPerTick);
  if (body.commitsPerLevel !== undefined) patch.commitsPerLevel = clampInt(body.commitsPerLevel, 1, 8, job.commitsPerLevel);
  if (body.commitHourUtc !== undefined) patch.commitHourUtc = clampInt(body.commitHourUtc, 0, 23, job.commitHourUtc);
  if (typeof body.order === "string") patch.order = body.order;
  if (typeof body.anchorDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.anchorDate)) {
    const d = new Date(`${body.anchorDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    patch.anchorDate = d.toISOString().slice(0, 10);
  }
  if (typeof body.patternId === "string") {
    const [p] = await db.select().from(patterns).where(eq(patterns.id, body.patternId)).limit(1);
    if (p) patch.patternId = p.id;
  }

  try {
    await db.update(jobs).set(patch).where(eq(jobs.id, id));
    const fresh = await loadJob(id);
    return ok({
      job: { ...fresh!.job, patternName: fresh!.pattern?.name ?? null, litCells: fresh!.lit },
      progress: progressOf(fresh!.job, fresh!.lit),
    });
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action ?? "tick";
  const loaded = await loadJob(id);
  if (!loaded) return fail("job not found", 404);
  const { job } = loaded;
  const now = new Date();

  try {
    switch (action) {
      case "start":
      case "resume": {
        await db
          .update(jobs)
          .set({ status: "running", nextTickAt: now, lastError: null, updatedAt: now })
          .where(eq(jobs.id, id));
        await logEvent(id, "info", `Painter resumed — ticking every ${job.intervalSeconds}s.`);
        break;
      }
      case "pause": {
        await db
          .update(jobs)
          .set({ status: "paused", nextTickAt: null, updatedAt: now })
          .where(eq(jobs.id, id));
        await logEvent(id, "warn", "Painter paused. Progress is preserved.");
        break;
      }
      case "cancel": {
        await db
          .update(jobs)
          .set({ status: "cancelled", nextTickAt: null, updatedAt: now })
          .where(eq(jobs.id, id));
        await logEvent(id, "warn", "Job cancelled.");
        break;
      }
      case "reset": {
        await db.delete(jobEvents).where(eq(jobEvents.jobId, id));
        await db
          .update(jobs)
          .set({
            status: "idle",
            painted: [],
            cellsPainted: 0,
            commitsCreated: 0,
            cursor: 0,
            lastError: null,
            nextTickAt: null,
            updatedAt: now,
          })
          .where(eq(jobs.id, id));
        await logEvent(id, "info", "Canvas wiped — the bitmap can be painted again from scratch.");
        break;
      }
      case "tick": {
        const previous = job.status;
        if (previous !== "running") {
          await db.update(jobs).set({ status: "running", nextTickAt: now }).where(eq(jobs.id, id));
        }
        const outcome = await tickJob(id);
        if (previous !== "running" && outcome.status !== "done") {
          await db.update(jobs).set({ status: previous, nextTickAt: null }).where(eq(jobs.id, id));
        }
        const fresh = await loadJob(id);
        return ok({ outcome, job: fresh!.job, progress: progressOf(fresh!.job, fresh!.lit) });
      }
      default:
        return fail(`unknown action: ${action}`);
    }

    const fresh = await loadJob(id);
    const events = await db
      .select()
      .from(jobEvents)
      .where(and(eq(jobEvents.jobId, id)))
      .orderBy(desc(jobEvents.createdAt))
      .limit(60);
    return ok({
      job: { ...fresh!.job, patternName: fresh!.pattern?.name ?? null, litCells: fresh!.lit },
      progress: progressOf(fresh!.job, fresh!.lit),
      events: events.reverse(),
    });
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await db.delete(jobEvents).where(eq(jobEvents.jobId, id));
    await db.delete(jobs).where(eq(jobs.id, id));
    return ok({ deleted: id });
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}
