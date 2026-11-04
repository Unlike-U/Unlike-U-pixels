import { dueJobs, logEvent, tickJob } from "./paint";

const TICK_MS = 4000;
const globalForScheduler = globalThis as typeof globalThis & {
  __pixelPainterTimer?: ReturnType<typeof setInterval>;
  __pixelPainterBusy?: boolean;
};

async function sweep() {
  if (globalForScheduler.__pixelPainterBusy) return;
  globalForScheduler.__pixelPainterBusy = true;
  try {
    const due = await dueJobs();
    for (const job of due) {
      const outcome = await tickJob(job.id);
      if (outcome.status === "error") {
        await logEvent(job.id, "error", `Scheduler halted the job: ${outcome.message}`).catch(
          () => undefined,
        );
      }
    }
  } catch {
    /* database may be mid-migration; retry on the next sweep */
  } finally {
    globalForScheduler.__pixelPainterBusy = false;
  }
}

/**
 * Boots the interval loop that drives every running paint job.
 * Registered from src/instrumentation.ts so it survives across requests.
 */
export function startScheduler() {
  if (globalForScheduler.__pixelPainterTimer) return;
  const timer = setInterval(() => {
    void sweep();
  }, TICK_MS);
  // don't keep a CLI process alive just for the painter
  (timer as unknown as { unref?: () => void }).unref?.();
  globalForScheduler.__pixelPainterTimer = timer;
  console.log("[pixelpunisher.x] scheduler online — sweeping every 4s");
}

export function schedulerOnline() {
  return Boolean(globalForScheduler.__pixelPainterTimer);
}
