import { sql } from "drizzle-orm";
import { db } from "@/db";
import { connections, jobs } from "@/db/schema";
import { readOAuthStatus } from "@/lib/oauth";
import { schedulerOnline } from "@/lib/scheduler";
import { errorMessage, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const oauth = await readOAuthStatus();
    const [{ nConnections }, { nJobs }, { nCommits }] = await Promise.all([
      db.select({ nConnections: sql<number>`count(*)::int` }).from(connections).then((r) => r[0]),
      db.select({ nJobs: sql<number>`count(*)::int` }).from(jobs).then((r) => r[0]),
      db
        .select({ nCommits: sql<number>`coalesce(sum(commits_created), 0)::int` })
        .from(jobs)
        .then((r) => r[0]),
    ]);
    return ok({
      oauth,
      deviceFlowConfigured: oauth.deviceFlowReady,
      schedulerOnline: schedulerOnline(),
      stats: {
        connections: nConnections ?? 0,
        jobs: nJobs ?? 0,
        commits: nCommits ?? 0,
      },
    });
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}
