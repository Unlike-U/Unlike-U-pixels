import { desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { connections, jobs, patterns } from "@/db/schema";
import { DEMO_JOB_ID } from "@/lib/demo";
import { clampInt, connectionWithToken, errorMessage, fail, ok } from "@/lib/api";
import { logEvent, newId } from "@/lib/paint";
import { anchorForWeeksBack, summarize } from "@/lib/grid";
import { ensureRepo, getUser } from "@/lib/github";

export const dynamic = "force-dynamic";

const ORDERS = ["column", "row", "intensity", "random", "spiral"] as const;

function normaliseAnchor(value?: string | null) {
  const raw = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : anchorForWeeksBack(52);
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return anchorForWeeksBack(52);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // snap back to Sunday
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const connectionId = url.searchParams.get("connectionId");
  try {
    // the public demo loop lives on the landing page, not in the studio
    const rows = await db
      .select()
      .from(jobs)
      .where(ne(jobs.id, DEMO_JOB_ID))
      .orderBy(desc(jobs.updatedAt))
      .limit(100);
    const filtered = connectionId ? rows.filter((r) => r.connectionId === connectionId) : rows;
    const ids = [...new Set(filtered.map((r) => r.patternId))];
    const pats = ids.length
      ? await db.select().from(patterns).where(inArray(patterns.id, ids))
      : [];
    const byId = new Map(pats.map((p) => [p.id, p]));
    return ok({
      jobs: filtered.map((job) => {
        const pattern = byId.get(job.patternId);
        const stats = pattern ? summarize(pattern.cells) : null;
        return { ...job, patternName: pattern?.name ?? null, litCells: stats?.lit ?? 0 };
      }),
    });
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patternId = String(body.patternId ?? "");
  if (!patternId) return fail("patternId is required");

  const [pattern] = await db.select().from(patterns).where(eq(patterns.id, patternId)).limit(1);
  if (!pattern) return fail("pattern not found", 404);

  const mode = body.mode === "github" ? "github" : "simulate";
  const connectionId = mode === "github" ? String(body.connectionId ?? "") : null;
  if (mode === "github" && !connectionId) return fail("connectionId is required for github mode");

  let repo: string | null = typeof body.repo === "string" && body.repo.trim() ? body.repo.trim() : null;
  let branch = String(body.branch ?? "main").trim() || "main";

  const intervalSeconds = clampInt(body.intervalSeconds, mode === "github" ? 30 : 3, 86400, mode === "github" ? 900 : 6);
  const cellsPerTick = clampInt(body.cellsPerTick, 1, 80, 6);
  const commitsPerLevel = clampInt(body.commitsPerLevel, 1, 8, 1);
  const commitHourUtc = clampInt(body.commitHourUtc, 0, 23, 12);
  const order = ORDERS.includes(body.order as (typeof ORDERS)[number])
    ? (body.order as (typeof ORDERS)[number])
    : "column";

  try {
    if (mode === "github" && connectionId) {
      const found = await connectionWithToken(connectionId);
      if (!found?.token) return fail("connection not found or token unreadable", 404);
      const me = await getUser(found.token);
      const wanted = repo ? repo.split("/").pop()! : `${me.login.toLowerCase()}-pixels`;
      const ensured = await ensureRepo(found.token, wanted, false);
      repo = ensured.full_name;
      branch = branch || ensured.default_branch;
      await db
        .update(connections)
        .set({ lastUsedAt: new Date() })
        .where(eq(connections.id, connectionId));
    }

    const lit = summarize(pattern.cells).lit;
    const autoStart = body.autoStart !== false;
    const now = new Date();

    const row = {
      id: newId("job"),
      connectionId,
      patternId,
      name: String(body.name ?? `paint ${pattern.name}`.slice(0, 80)),
      mode,
      status: autoStart ? "running" : "idle",
      repo,
      branch,
      commitPath: String(body.commitPath ?? ".paint/pixels.txt").trim() || ".paint/pixels.txt",
      commitMessage: String(body.commitMessage ?? "paint: {cell} level {level}").slice(0, 140),
      intervalSeconds,
      cellsPerTick,
      commitsPerLevel,
      commitHourUtc,
      anchorDate: normaliseAnchor(body.anchorDate as string | null),
      cellsPainted: 0,
      commitsCreated: 0,
      painted: [] as number[],
      lastTickAt: null,
      nextTickAt: autoStart ? now : null,
      lastError: null,
      cursor: 0,
      order,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(jobs).values(row);
    await logEvent(
      row.id,
      "info",
      mode === "github"
        ? `Job armed: ${lit} lit cells → ${repo}@${branch}, ${cellsPerTick} cells every ${intervalSeconds}s.`
        : `Simulated job armed: ${lit} lit cells, ${cellsPerTick} cells every ${intervalSeconds}s. No GitHub calls will be made.`,
      { lit, mode, intervalSeconds, cellsPerTick },
    );

    return ok({ job: { ...row, patternName: pattern.name, litCells: lit } }, { status: 201 });
  } catch (err) {
    return fail(errorMessage(err), 502);
  }
}
