import { randomUUID } from "crypto";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { connections, jobEvents, jobs, patterns } from "@/db/schema";
import type { Job } from "@/db/schema";
import { decrypt } from "./crypto";
import {
  COLS,
  ROWS,
  clampLevel,
  colOf,
  commitsForLevel,
  dateForCell,
  isoDate,
  paintOrder,
  rowOf,
} from "./grid";
import { GitHubError, getUser, paintCommits, resolveCommitEmail } from "./github";

export const newId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 14)}`;

export type EventLevel = "info" | "success" | "warn" | "error";

export async function logEvent(
  jobId: string,
  level: EventLevel,
  message: string,
  meta?: Record<string, unknown>,
) {
  await db.insert(jobEvents).values({
    id: newId("ev"),
    jobId,
    level,
    message,
    meta: meta ?? null,
  });
}

function expandMessage(template: string, ctx: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(ctx[k] ?? `{${k}}`));
}

export type TickOutcome =
  | { status: "skipped"; reason: string }
  | { status: "painted"; cells: number; commits: number; remaining: number }
  | { status: "done"; cells: number; commits: number }
  | { status: "error"; message: string };

const inFlight = new Set<string>();

/** One scheduler tick: paint the next batch of cells for a job. */
export async function tickJob(jobId: string): Promise<TickOutcome> {
  if (inFlight.has(jobId)) return { status: "skipped", reason: "already running" };
  inFlight.add(jobId);
  try {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) return { status: "skipped", reason: "job missing" };
    if (job.status !== "running") return { status: "skipped", reason: `status=${job.status}` };

    const [pattern] = await db
      .select()
      .from(patterns)
      .where(eq(patterns.id, job.patternId))
      .limit(1);
    if (!pattern) {
      await db.update(jobs).set({ status: "error", lastError: "pattern missing" }).where(eq(jobs.id, jobId));
      return { status: "error", message: "pattern missing" };
    }

    const cells = Array.isArray(pattern.cells) ? pattern.cells : [];
    const painted = new Set(Array.isArray(job.painted) ? job.painted : []);
    const ordered = paintOrder(cells, (job.order as never) ?? "column").filter((i) => !painted.has(i));
    const batch = ordered.slice(0, Math.max(1, job.cellsPerTick));

    const now = new Date();
    if (!batch.length) {
      await db
        .update(jobs)
        .set({ status: "done", lastTickAt: now, nextTickAt: null, updatedAt: now })
        .where(eq(jobs.id, jobId));
      await logEvent(jobId, "success", "Bitmap complete — every lit pixel is on GitHub.");
      return { status: "done", cells: painted.size, commits: job.commitsCreated };
    }

    const anchor = job.anchorDate ?? isoDate(new Date(Date.now() - 364 * 86400000));
    const requests: { message: string; date: string }[] = [];
    const perCell: { index: number; level: number; commits: number; date: string }[] = [];

    // GitHub ignores (and sometimes rejects) commits dated in the future, so
    // pixels that fall later this week are pulled back to "just now".
    const ceiling = now.getTime() - 120_000;
    let clamped = 0;

    batch.forEach((index, n) => {
      const level = clampLevel(cells[index] ?? 0);
      const count = commitsForLevel(level, job.commitsPerLevel);
      if (!count) return;
      const when = dateForCell(anchor, index, job.commitHourUtc);
      // spread commits inside the day so timestamps are unique & human-like
      when.setUTCMinutes(((n * 37 + index * 11) % 59) * 5, (index * 7) % 60);
      if (when.getTime() > ceiling) {
        when.setTime(ceiling - clamped * 61_000);
        clamped += 1;
      }
      for (let k = 0; k < count; k++) {
        const t = new Date(Math.min(when.getTime() + k * 61_000, ceiling - k * 1000));
        requests.push({
          message: expandMessage(job.commitMessage, {
            cell: `w${colOf(index) + 1}/d${rowOf(index) + 1}`,
            level,
            date: isoDate(t),
            index,
            n: k + 1,
            total: count,
            pattern: pattern.name,
          }),
          date: t.toISOString(),
        });
      }
      perCell.push({ index, level, commits: count, date: isoDate(when) });
    });

    if (!requests.length) {
      // whole batch was level-0 → mark painted and move on
      const paintedNext = [...painted, ...batch];
      await db
        .update(jobs)
        .set({
          painted: paintedNext,
          cellsPainted: paintedNext.length,
          lastTickAt: now,
          nextTickAt: new Date(now.getTime() + job.intervalSeconds * 1000),
          updatedAt: now,
        })
        .where(eq(jobs.id, jobId));
      return {
        status: "painted",
        cells: 0,
        commits: 0,
        remaining: ordered.length - batch.length,
      };
    }

    let created = requests.length;

    if (job.mode === "github") {
      if (!job.connectionId || !job.repo) {
        await db.update(jobs).set({ status: "error", lastError: "missing connection or repo" }).where(eq(jobs.id, jobId));
        await logEvent(jobId, "error", "Job needs a GitHub connection and a target repository.");
        return { status: "error", message: "missing connection or repo" };
      }
      const [conn] = await db
        .select()
        .from(connections)
        .where(eq(connections.id, job.connectionId))
        .limit(1);
      const token = decrypt(conn?.tokenCipher ?? null);
      if (!conn || !token) {
        await db.update(jobs).set({ status: "error", lastError: "token unavailable" }).where(eq(jobs.id, jobId));
        await logEvent(jobId, "error", "Stored token could not be decrypted. Reconnect the account.");
        return { status: "error", message: "token unavailable" };
      }
      try {
        const me = await getUser(token);
        const email = await resolveCommitEmail(token, me.login, me.id);
        const paintedSoFar = painted.size + batch.length;
        const result = await paintCommits(token, {
          repo: job.repo,
          branch: job.branch,
          path: job.commitPath,
          authorName: me.name ?? me.login,
          authorEmail: email,
          requests,
          content: [
            "# pixelpunisher.x manifest",
            "",
            `pattern:  ${pattern.name}`,
            `job:      ${job.id}`,
            `painted:  ${paintedSoFar} / ${cells.filter((c) => c > 0).length} lit cells`,
            `commits:  ${job.commitsCreated + requests.length}`,
            `updated:  ${new Date().toISOString()}`,
            "",
            ...perCell.map(
              (p) => `cell[${p.index}] week=${colOf(p.index) + 1} day=${rowOf(p.index) + 1} level=${p.level} commits=${p.commits}`,
            ),
          ].join("\n"),
        });
        created = result.commits;
      } catch (err) {
        const message =
          err instanceof GitHubError ? `${err.message} (HTTP ${err.status})` : String(err);
        await db
          .update(jobs)
          .set({ status: "error", lastError: message, lastTickAt: now, updatedAt: now })
          .where(eq(jobs.id, jobId));
        await logEvent(jobId, "error", `Paint failed: ${message}`);
        return { status: "error", message };
      }
    }

    const paintedNext = [...painted, ...batch];
    const remaining = ordered.length - batch.length;
    const finished = remaining <= 0;

    await db
      .update(jobs)
      .set({
        painted: paintedNext,
        cellsPainted: paintedNext.length,
        commitsCreated: job.commitsCreated + created,
        cursor: job.cursor + batch.length,
        lastTickAt: now,
        nextTickAt: finished ? null : new Date(now.getTime() + job.intervalSeconds * 1000),
        status: finished ? "done" : "running",
        lastError: null,
        updatedAt: now,
      })
      .where(eq(jobs.id, jobId));

    await logEvent(
      jobId,
      finished ? "success" : "info",
      finished
        ? `Final tick: painted ${batch.length} cells with ${created} commits. Bitmap complete.`
        : `Tick: painted ${batch.length} cells (${created} commits${job.mode === "github" ? " pushed" : " simulated"}) — ${remaining} to go.`,
      {
        cells: perCell,
        commits: created,
        remaining,
        mode: job.mode,
        ...(clamped ? { clampedFutureCells: clamped } : {}),
      },
    );

    return finished
      ? { status: "done", cells: paintedNext.length, commits: job.commitsCreated + created }
      : { status: "painted", cells: batch.length, commits: created, remaining };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(jobs)
      .set({ status: "error", lastError: message, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .catch(() => undefined);
    return { status: "error", message };
  } finally {
    inFlight.delete(jobId);
  }
}

/** Jobs whose next tick is due. */
export async function dueJobs(limit = 25): Promise<Job[]> {
  const rows = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.status, "running"),
        or(isNull(jobs.nextTickAt), lte(jobs.nextTickAt, new Date())),
      ),
    )
    .orderBy(sql`${jobs.nextTickAt} asc nulls first`)
    .limit(limit);
  return rows;
}

export function progressOf(job: Job, litCells: number) {
  const done = job.cellsPainted;
  const percent = litCells ? Math.min(100, Math.round((done / litCells) * 100)) : 0;
  const remaining = Math.max(0, litCells - done);
  const ticksLeft = Math.ceil(remaining / Math.max(1, job.cellsPerTick));
  const etaMs = ticksLeft * job.intervalSeconds * 1000;
  return { done, percent, remaining, ticksLeft, etaMs };
}

export const GRID_SIZE = { COLS, ROWS };
