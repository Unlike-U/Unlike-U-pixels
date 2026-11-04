"use client";

import Link from "next/link";
import PixelGrid from "./PixelGrid";
import { Button, Meter, StatusPill } from "./ui";
import { api, formatDuration, timeAgo } from "@/lib/client";
import type { EventView, Progress } from "@/lib/client";
import { useNow, usePoll } from "@/lib/hooks";
import { summarize } from "@/lib/grid";
import { IconArrowRight, IconBolt } from "./Icons";

type DemoResponse = {
  job: {
    id: string;
    status: string;
    mode: string;
    intervalSeconds: number;
    cellsPerTick: number;
    cellsPainted: number;
    commitsCreated: number;
    lastTickAt: string | null;
    nextTickAt: string | null;
    painted: number[];
  };
  pattern: { id: string; name: string; cells: number[] };
  litCells: number;
  progress: Progress;
  events: EventView[];
};

export default function LiveCanvas() {
  const { data, error } = usePoll<DemoResponse>(() => api<DemoResponse>("/api/demo"), 1500);
  const now = useNow(500);

  const cells = data?.pattern.cells ?? [];
  const stats = cells.length ? summarize(cells) : null;
  const nextTick = data?.job.nextTickAt ? new Date(data.job.nextTickAt).getTime() : null;
  const countdown = nextTick ? Math.max(0, nextTick - now) : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-ink-600 bg-ink-900/85 p-4 shadow-[0_40px_120px_-60px_rgba(200,247,81,0.35)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
        <div className="animate-sweep h-px w-1/3 bg-gradient-to-r from-transparent via-acid-400 to-transparent" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-jade-500/20 text-jade-300">
            <IconBolt width={15} height={15} />
          </span>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-mist-400">
              live painter · simulate mode
            </div>
            <div className="text-[13px] text-mist-100">{data?.pattern.name ?? "warming up…"}</div>
          </div>
        </div>
        <StatusPill status={data?.job.status ?? "idle"} pulse />
      </div>

      <div className="mt-4">
        {stats ? (
          <PixelGrid cells={cells} painted={data?.job.painted ?? []} compact />
        ) : (
          <div className="hatch flex h-[86px] items-center justify-center rounded-md font-mono text-[11px] text-mist-400">
            {error ? `demo offline: ${error}` : "booting scheduler…"}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "pixels lit", v: stats?.lit ?? 0 },
          { k: "painted", v: `${data?.progress.done ?? 0}/${stats?.lit ?? 0}` },
          { k: "commits", v: data?.job.commitsCreated ?? 0 },
          {
            k: "next tick",
            v: countdown === null ? "—" : formatDuration(countdown),
          },
        ].map((s) => (
          <div key={s.k} className="rounded-md border border-ink-700 bg-ink-850/70 px-2.5 py-2">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-mist-400">{s.k}</div>
            <div className="mt-0.5 font-mono text-base tabular-nums text-acid-300">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <Meter percent={data?.progress.percent ?? 0} />
      </div>

      <div className="mt-3 max-h-[104px] space-y-1 overflow-hidden rounded-md border border-ink-700 bg-ink-950/60 p-2.5 font-mono text-[10.5px] leading-relaxed">
        {(data?.events ?? []).slice(-5).map((e) => (
          <div key={e.id} className="flex gap-2">
            <span className="shrink-0 text-mist-400/70">
              {new Date(e.createdAt).toISOString().slice(11, 19)}
            </span>
            <span
              className={
                e.level === "error"
                  ? "text-red-300"
                  : e.level === "success"
                    ? "text-jade-300"
                    : e.level === "warn"
                      ? "text-rust-400"
                      : "text-mist-200"
              }
            >
              {e.message}
            </span>
          </div>
        ))}
        {!data?.events?.length && <div className="text-mist-400">waiting for first tick…</div>}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] text-mist-400">
          last tick {timeAgo(data?.job.lastTickAt)} · {data?.job.cellsPerTick ?? 0} cells/tick · every{" "}
          {data?.job.intervalSeconds ?? 0}s
        </span>
        <Link href="/studio">
          <Button variant="acid" size="sm" icon={<IconArrowRight width={13} height={13} />}>
            open studio
          </Button>
        </Link>
      </div>
    </div>
  );
}
