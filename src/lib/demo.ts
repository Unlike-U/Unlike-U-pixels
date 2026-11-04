import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobEvents, jobs, patterns } from "@/db/schema";
import { PRESETS } from "./grid";
import type { Cells } from "./grid";

export const DEMO_PATTERN_ID = "pat_demo_canvas";
export const DEMO_JOB_ID = "job_demo_canvas";

let rotation = 0;

function nextDemoCells(): { cells: Cells; name: string } {
  const preset = PRESETS[rotation % PRESETS.length];
  rotation += 1;
  return { cells: preset.build(), name: `demo · ${preset.name}` };
}

/**
 * A public, self-resetting simulate-mode job so visitors can watch the
 * interval painter work without connecting anything.
 */
export async function getDemoJob() {
  let [job] = await db.select().from(jobs).where(eq(jobs.id, DEMO_JOB_ID)).limit(1);
  let [pattern] = await db.select().from(patterns).where(eq(patterns.id, DEMO_PATTERN_ID)).limit(1);

  if (!pattern) {
    const seed = nextDemoCells();
    pattern = {
      id: DEMO_PATTERN_ID,
      connectionId: null,
      name: seed.name,
      width: 53,
      height: 7,
      cells: seed.cells,
      palette: "moss",
      source: "demo",
      createdAt: new Date(),
      updatedAt: new Date(),
      starred: true,
    };
    await db.insert(patterns).values(pattern);
  }

  if (!job) {
    job = {
      id: DEMO_JOB_ID,
      connectionId: null,
      patternId: DEMO_PATTERN_ID,
      name: "Public demo loop",
      mode: "simulate",
      status: "running",
      repo: null,
      branch: "main",
      commitPath: ".paint/pixels.txt",
      commitMessage: "paint: {cell} level {level}",
      intervalSeconds: 5,
      cellsPerTick: 4,
      commitsPerLevel: 1,
      commitHourUtc: 12,
      anchorDate: null,
      cellsPainted: 0,
      commitsCreated: 0,
      painted: [],
      lastTickAt: null,
      nextTickAt: new Date(),
      lastError: null,
      cursor: 0,
      order: "column",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.insert(jobs).values(job);
  }

  // loop forever: when the bitmap is complete, load the next preset and restart
  if (job.status === "done" || job.status === "error") {
    const seed = nextDemoCells();
    await db
      .update(patterns)
      .set({ cells: seed.cells, name: seed.name, updatedAt: new Date() })
      .where(eq(patterns.id, DEMO_PATTERN_ID));
    await db
      .update(jobs)
      .set({
        status: "running",
        painted: [],
        cellsPainted: 0,
        commitsCreated: 0,
        cursor: 0,
        lastError: null,
        nextTickAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, DEMO_JOB_ID));
    await db.delete(jobEvents).where(eq(jobEvents.jobId, DEMO_JOB_ID));
    const [freshJob] = await db.select().from(jobs).where(eq(jobs.id, DEMO_JOB_ID)).limit(1);
    const [freshPattern] = await db
      .select()
      .from(patterns)
      .where(eq(patterns.id, DEMO_PATTERN_ID))
      .limit(1);
    return { job: freshJob, pattern: freshPattern };
  }

  if (job.status === "idle" || job.status === "paused") {
    await db.update(jobs).set({ status: "running", nextTickAt: new Date() }).where(eq(jobs.id, DEMO_JOB_ID));
    const [freshJob] = await db.select().from(jobs).where(eq(jobs.id, DEMO_JOB_ID)).limit(1);
    return { job: freshJob, pattern };
  }

  return { job, pattern };
}
