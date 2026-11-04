import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, patterns } from "@/db/schema";
import { fail } from "@/lib/api";
import { clampLevel, colOf, commitsForLevel, dateForCell, paintOrder, rowOf } from "@/lib/grid";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The full commit plan as CSV: every pixel, the calendar day it lands on and
 * how many backdated commits it will take.
 */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const onlyRemaining = url.searchParams.get("remaining") === "1";

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!job) return fail("job not found", 404);
  const [pattern] = await db.select().from(patterns).where(eq(patterns.id, job.patternId)).limit(1);
  if (!pattern) return fail("pattern not found", 404);

  const painted = new Set(Array.isArray(job.painted) ? job.painted : []);
  const anchor = job.anchorDate ?? new Date().toISOString().slice(0, 10);
  const order = paintOrder(pattern.cells, (job.order as never) ?? "column");

  const rows = [
    "sequence,cell_index,week,day,date,level,commits,painted,commit_message",
  ];

  let seq = 0;
  for (const index of order) {
    const level = clampLevel(pattern.cells[index] ?? 0);
    if (level <= 0) continue;
    if (onlyRemaining && painted.has(index)) continue;
    const commits = commitsForLevel(level, job.commitsPerLevel);
    const when = dateForCell(anchor, index, job.commitHourUtc);
    seq += 1;
    const message = job.commitMessage
      .replace(/\{cell\}/g, `w${colOf(index) + 1}/d${rowOf(index) + 1}`)
      .replace(/\{level\}/g, String(level))
      .replace(/\{date\}/g, when.toISOString().slice(0, 10))
      .replace(/\{index\}/g, String(index))
      .replace(/\{pattern\}/g, pattern.name);
    rows.push(
      [
        seq,
        index,
        colOf(index) + 1,
        DAYS[rowOf(index)],
        when.toISOString().slice(0, 10),
        level,
        commits,
        painted.has(index) ? "yes" : "no",
        `"${message.replace(/"/g, '""')}"`,
      ].join(","),
    );
  }

  return new Response(rows.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="paint-plan-${job.id}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
