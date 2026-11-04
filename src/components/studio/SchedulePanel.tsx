"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Field, Meter, Panel, Select, Stat, StatusPill, TextInput } from "@/components/ui";
import {
  IconBolt,
  IconCheck,
  IconClock,
  IconDownload,
  IconPause,
  IconPlay,
  IconReset,
  IconSpinner,
  IconTrash,
  IconWarn,
} from "@/components/Icons";
import { formatDuration, formatInterval, timeAgo } from "@/lib/client";
import type { ConnectionView, EventView, JobView, Progress } from "@/lib/client";
import { useNow } from "@/lib/hooks";
import { cn } from "@/lib/cn";

export type JobConfig = {
  mode: "github" | "simulate";
  repo: string;
  branch: string;
  commitPath: string;
  commitMessage: string;
  intervalSeconds: number;
  cellsPerTick: number;
  commitsPerLevel: number;
  commitHourUtc: number;
  order: string;
  anchorDate: string | null;
  name: string;
};

type Props = {
  job: JobView | null;
  progress: Progress | null;
  events: EventView[];
  jobs: JobView[];
  connection: ConnectionView | null;
  litCells: number;
  repos: { fullName: string; name: string; private: boolean; fork: boolean; defaultBranch: string }[];
  reposLoading: boolean;
  rateLimit: { remaining: number; limit: number } | null;
  onLoadRepos: () => void;
  onCreate: (config: JobConfig) => void;
  onControl: (action: "start" | "pause" | "tick" | "reset" | "cancel") => void;
  onPatch: (patch: Partial<JobConfig>) => void;
  onSelectJob: (id: string) => void;
  onDeleteJob: (id: string) => void;
  busy: boolean;
};

const ORDERS = [
  ["column", "week by week (left → right)"],
  ["row", "day by day (Sun → Sat)"],
  ["intensity", "darkest pixels first"],
  ["spiral", "from the centre outwards"],
  ["random", "shuffled"],
] as const;

const INTERVAL_CHOICES = [
  [30, "30 seconds"],
  [60, "1 minute"],
  [300, "5 minutes"],
  [900, "15 minutes"],
  [3600, "1 hour"],
  [21600, "6 hours"],
  [86400, "24 hours"],
] as const;

export default function SchedulePanel(props: Props) {
  const {
    job,
    progress,
    events,
    jobs,
    connection,
    litCells,
    repos,
    reposLoading,
    rateLimit,
    onLoadRepos,
    onCreate,
    onControl,
    onPatch,
    onSelectJob,
    onDeleteJob,
    busy,
  } = props;

  const [config, setConfig] = useState<JobConfig>({
    mode: connection ? "github" : "simulate",
    repo: "",
    branch: "main",
    commitPath: ".paint/pixels.txt",
    commitMessage: "paint: {cell} · level {level}",
    intervalSeconds: connection ? 900 : 6,
    cellsPerTick: 6,
    commitsPerLevel: 1,
    commitHourUtc: 12,
    order: "column",
    anchorDate: null,
    name: "bitmap painter",
  });

  const now = useNow(1000);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (connection && config.mode === "simulate") setConfig((c) => ({ ...c, mode: "github" }));
    if (!connection && config.mode === "github") setConfig((c) => ({ ...c, mode: "simulate" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.id]);

  useEffect(() => {
    if (connection && !config.repo) {
      setConfig((c) => ({ ...c, repo: `${c.mode === "github" ? connection.login.toLowerCase() : ""}-pixels` }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.id]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const nextTick = job?.nextTickAt ? new Date(job.nextTickAt).getTime() : null;
  const countdown = nextTick ? Math.max(0, nextTick - now) : null;

  const totalCommits = job?.commitsCreated ?? 0;

  const set = <K extends keyof JobConfig>(key: K, value: JobConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  return (
    <div className="space-y-4">
      <Panel
        step="3"
        title="the interval"
        subtitle="The server-side scheduler sweeps every 4s and runs any job whose next tick is due."
        right={job ? <StatusPill status={job.status} pulse /> : undefined}
      >
        {!job ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(["github", "simulate"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => set("mode", m)}
                  disabled={m === "github" && !connection}
                  className={cn(
                    "rounded-md border px-3 py-2.5 text-left transition-all disabled:opacity-40",
                    config.mode === m
                      ? "border-acid-400/60 bg-acid-400/5"
                      : "border-ink-700 bg-ink-850/50 hover:border-ink-500",
                  )}
                >
                  <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-mist-100">
                    {m === "github" ? "paint to github" : "simulate offline"}
                  </div>
                  <div className="mt-1 text-[11px] leading-snug text-mist-400">
                    {m === "github"
                      ? "real commits via the Git Data API"
                      : "identical loop, virtual canvas"}
                  </div>
                </button>
              ))}
            </div>

            {config.mode === "github" && (
              <>
                <Field
                  label="target repository"
                  hint="Created for you if it doesn't exist. Must be standalone (not a fork) for commits to reach the graph."
                >
                  <div className="flex gap-2">
                    <TextInput
                      value={config.repo}
                      onChange={(e) => set("repo", e.target.value)}
                      placeholder={`${connection?.login ?? "you"}-pixels`}
                    />
                    <Button size="sm" onClick={onLoadRepos} disabled={reposLoading}>
                      {reposLoading ? <IconSpinner width={13} height={13} /> : "list"}
                    </Button>
                  </div>
                </Field>
                {repos.length > 0 && (
                  <Field label="or pick an existing repo">
                    <Select
                      value=""
                      onChange={(e) => {
                        const found = repos.find((r) => r.fullName === e.target.value);
                        if (found) {
                          set("repo", found.fullName.split("/").pop() ?? found.name);
                          set("branch", found.defaultBranch || "main");
                        }
                      }}
                    >
                      <option value="">— select —</option>
                      {repos.map((r) => (
                        <option key={r.fullName} value={r.fullName}>
                          {r.fullName}
                          {r.private ? " (private)" : ""}
                          {r.fork ? " (fork — won't count)" : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                {rateLimit && (
                  <div className="flex items-center justify-between rounded-md border border-ink-700 bg-ink-850/60 px-3 py-2 font-mono text-[10.5px] text-mist-400">
                    <span>api quota</span>
                    <span className="text-mist-100">
                      {rateLimit.remaining} / {rateLimit.limit} remaining
                    </span>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="tick interval">
                <Select
                  value={String(config.intervalSeconds)}
                  onChange={(e) => set("intervalSeconds", Number(e.target.value))}
                >
                  {INTERVAL_CHOICES.map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                  {config.mode === "simulate" && <option value={5}>5 seconds (demo)</option>}
                </Select>
              </Field>
              <Field label="cells per tick" hint={`${litCells} lit cells in this bitmap`}>
                <input
                  type="range"
                  min={1}
                  max={Math.max(4, Math.min(60, litCells || 40))}
                  value={config.cellsPerTick}
                  onChange={(e) => set("cellsPerTick", Number(e.target.value))}
                  className="mt-2 w-full accent-[#c8f751]"
                />
                <div className="mt-1 font-mono text-[11px] text-acid-300">{config.cellsPerTick}</div>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="paint order">
                <Select value={config.order} onChange={(e) => set("order", e.target.value)}>
                  {ORDERS.map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="commit multiplier" hint="raise it if your year is already busy">
                <Select
                  value={String(config.commitsPerLevel)}
                  onChange={(e) => set("commitsPerLevel", Number(e.target.value))}
                >
                  {[1, 2, 3, 4].map((v) => (
                    <option key={v} value={v}>
                      {v}× ({v}–{v * 4} commits/day)
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {config.mode === "github" && (
              <>
                <Field label="commit message template" hint="tokens: {cell} {level} {date} {index} {n} {total} {pattern}">
                  <TextInput
                    value={config.commitMessage}
                    onChange={(e) => set("commitMessage", e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="branch">
                    <TextInput value={config.branch} onChange={(e) => set("branch", e.target.value)} />
                  </Field>
                  <Field label="commit hour (utc)">
                    <Select
                      value={String(config.commitHourUtc)}
                      onChange={(e) => set("commitHourUtc", Number(e.target.value))}
                    >
                      {Array.from({ length: 24 }).map((_, h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, "0")}:00
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </>
            )}

            <div className="rounded-md border border-ink-700 bg-ink-950/60 p-3">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mist-400">
                <IconClock width={12} height={12} /> projection
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-mist-200">
                {litCells} lit cells ÷ {config.cellsPerTick} per tick ={" "}
                <span className="font-mono text-acid-300">
                  {Math.ceil(litCells / Math.max(1, config.cellsPerTick))} ticks
                </span>{" "}
                at {formatInterval(config.intervalSeconds)} → finishes in{" "}
                <span className="font-mono text-acid-300">
                  {formatDuration(
                    Math.ceil(litCells / Math.max(1, config.cellsPerTick)) *
                      config.intervalSeconds *
                      1000,
                  )}
                </span>
                {config.mode === "github" && (
                  <>
                    {" "}
                    · ≈
                    <span className="font-mono text-acid-300">
                      {Math.round(litCells * config.commitsPerLevel * 2.5)}
                    </span>{" "}
                    API calls
                  </>
                )}
              </p>
            </div>

            <Button
              variant="acid"
              className="w-full"
              disabled={busy || !litCells}
              onClick={() => onCreate(config)}
              icon={busy ? <IconSpinner width={14} height={14} /> : <IconBolt width={14} height={14} />}
            >
              {busy ? "arming…" : litCells ? "arm the painter" : "paint some pixels first"}
            </Button>

            <p className="text-[11.5px] leading-relaxed text-mist-400">
              Arming stores the plan in Postgres and hands it to the scheduler — it runs on the
              server, so you can close this tab. Each tick converts the next{" "}
              <span className="font-mono text-mist-200">{config.cellsPerTick}</span> pixels into
              commits dated on their calendar day{config.mode === "github" ? " and pushes them to GitHub" : " on a virtual canvas"}.
            </p>
            {!litCells && (
              <p className="flex items-center gap-2 text-[11.5px] text-mist-400">
                <IconWarn width={13} height={13} className="text-rust-400" /> The canvas is empty —
                draw something or load a preset.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="cells painted" value={`${progress?.done ?? 0}/${litCells}`} accent />
              <Stat label="commits" value={job.commitsCreated} sub={`${totalCommits} recorded`} />
              <Stat label="next tick" value={countdown === null ? "—" : formatDuration(countdown)} />
              <Stat
                label="eta"
                value={formatDuration(progress?.etaMs ?? 0)}
                sub={`${progress?.ticksLeft ?? 0} ticks left`}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-mist-400">
                <span>bitmap developed</span>
                <span className="text-acid-300">{progress?.percent ?? 0}%</span>
              </div>
              <Meter percent={progress?.percent ?? 0} />
            </div>

            {job.lastError && (
              <p className="flex items-start gap-2 rounded-md border border-red-400/30 bg-red-400/5 p-2.5 text-[11.5px] leading-relaxed text-red-300">
                <IconWarn width={14} height={14} className="mt-0.5 shrink-0" />
                {job.lastError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="tick interval">
                <Select
                  value={String(job.intervalSeconds)}
                  onChange={(e) => onPatch({ intervalSeconds: Number(e.target.value) })}
                >
                  {[...INTERVAL_CHOICES.map((c) => c[0]), job.intervalSeconds]
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .sort((a, b) => a - b)
                    .map((v) => (
                      <option key={v} value={v}>
                        {formatInterval(v)}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="cells per tick">
                <Select
                  value={String(job.cellsPerTick)}
                  onChange={(e) => onPatch({ cellsPerTick: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 6, 8, 12, 20, 40]
                    .filter((v, i, arr) => arr.indexOf(v) === i || v === job.cellsPerTick)
                    .concat(job.cellsPerTick)
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .sort((a, b) => a - b)
                    .map((v) => (
                      <option key={v} value={v}>
                        {v} cells
                      </option>
                    ))}
                </Select>
              </Field>
            </div>

            <div className="rounded-md border border-ink-700 bg-ink-950/60 p-3 font-mono text-[11px] leading-relaxed text-mist-300">
              <div className="flex justify-between gap-2">
                <span className="text-mist-400">mode</span>
                <span className="text-mist-100">{job.mode}</span>
              </div>
              {job.repo && (
                <div className="flex justify-between gap-2">
                  <span className="text-mist-400">repo</span>
                  <a
                    href={`https://github.com/${job.repo}`}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-acid-300 hover:underline"
                  >
                    {job.repo}@{job.branch}
                  </a>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-mist-400">anchor</span>
                <span className="text-mist-100">{job.anchorDate ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-mist-400">last tick</span>
                <span className="text-mist-100">{timeAgo(job.lastTickAt)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {job.status === "running" ? (
                <Button
                  variant="outline"
                  onClick={() => onControl("pause")}
                  disabled={busy}
                  icon={<IconPause width={13} height={13} />}
                >
                  pause
                </Button>
              ) : (
                <Button
                  variant="acid"
                  onClick={() => onControl("start")}
                  disabled={busy || job.status === "done"}
                  icon={<IconPlay width={13} height={13} />}
                >
                  {job.status === "done" ? "finished" : "resume"}
                </Button>
              )}
              <Button
                onClick={() => onControl("tick")}
                disabled={busy}
                icon={<IconBolt width={13} height={13} />}
              >
                tick now
              </Button>
              <Button
                variant="ghost"
                onClick={() => onControl("reset")}
                disabled={busy}
                icon={<IconReset width={13} height={13} />}
              >
                reset
              </Button>
              <a
                href={`/api/jobs/${job.id}/plan?remaining=1`}
                download
                className="inline-flex items-center justify-center gap-2 rounded-md border border-ink-500 bg-ink-850 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-mist-200 transition-colors hover:border-jade-300/60 hover:text-mist-100"
              >
                <IconDownload width={13} height={13} />
                commit plan
              </a>
              <Button
                variant="danger"
                className="ml-auto"
                onClick={() => onDeleteJob(job.id)}
                disabled={busy}
                icon={<IconTrash width={13} height={13} />}
              >
                delete
              </Button>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="run log"
        subtitle="Every tick writes here — what it painted, how many commits, what's left."
        right={
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mist-400">
            {events.length} events
          </span>
        }
      >
        <div
          ref={logRef}
          className="h-52 space-y-1.5 overflow-y-auto rounded-md border border-ink-700 bg-ink-950/70 p-3 font-mono text-[11px] leading-relaxed"
        >
          {events.length === 0 && (
            <div className="text-mist-400">
              no ticks yet — arm a job and the scheduler will start logging here.
            </div>
          )}
          {events.map((e) => (
            <div key={e.id} className="flex gap-2.5">
              <span className="shrink-0 text-mist-400/60">
                {new Date(e.createdAt).toISOString().slice(11, 19)}
              </span>
              <span
                className={cn(
                  e.level === "error" && "text-red-300",
                  e.level === "success" && "text-jade-300",
                  e.level === "warn" && "text-rust-400",
                  e.level === "info" && "text-mist-200",
                )}
              >
                {e.level === "success" && <IconCheck width={11} height={11} className="mr-1 inline" />}
                {e.message}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      {jobs.length > 1 && (
        <Panel title="all jobs" subtitle="Switch between canvases, or clean up old runs.">
          <ul className="space-y-1.5">
            {jobs.map((j) => (
              <li
                key={j.id}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2",
                  j.id === job?.id
                    ? "border-acid-400/50 bg-acid-400/5"
                    : "border-ink-700 bg-ink-850/40",
                )}
              >
                <button onClick={() => onSelectJob(j.id)} className="min-w-0 flex-1 text-left">
                  <div className="truncate font-mono text-[11.5px] text-mist-100">
                    {j.patternName ?? j.name}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-mist-400">
                    {j.mode} · {j.status} · {j.cellsPainted} cells · {j.commitsCreated} commits ·{" "}
                    {timeAgo(j.lastTickAt)}
                  </div>
                </button>
                <button
                  onClick={() => onDeleteJob(j.id)}
                  className="rounded p-1.5 text-mist-400 transition-colors hover:bg-rust-400/10 hover:text-rust-400"
                  aria-label="delete job"
                >
                  <IconTrash width={13} height={13} />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
