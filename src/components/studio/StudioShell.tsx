"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import CanvasPanel from "./CanvasPanel";
import ConnectPanel from "./ConnectPanel";
import SchedulePanel from "./SchedulePanel";
import type { JobConfig } from "./SchedulePanel";
import VerifyPanel from "./VerifyPanel";
import HowItWorks from "@/components/HowItWorks";
import { LogoMini, Wordmark } from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import PixelGrid from "@/components/PixelGrid";
import { Button, Panel } from "@/components/ui";
import {
  IconBolt,
  IconCheck,
  IconGitHub,
  IconSpinner,
  IconTerminal,
  IconWarn,
} from "@/components/Icons";
import { api, patch, post } from "@/lib/client";
import type { ConnectionView, EventView, JobView, PatternView, Progress } from "@/lib/client";
import type { OAuthConfig } from "./ConnectPanel";
import { usePoll } from "@/lib/hooks";
import { PRESETS, emptyCells, textToCells } from "@/lib/grid";
import { cn } from "@/lib/cn";

type Meta = {
  oauth: { clientId: string | null; source: string; webFlowReady: boolean; deviceFlowReady: boolean };
  schedulerOnline: boolean;
  stats: { connections: number; jobs: number; commits: number };
};

type Repo = { fullName: string; name: string; private: boolean; fork: boolean; defaultBranch: string };

type JobDetail = {
  job: JobView;
  pattern: PatternView | null;
  progress: Progress;
  events: EventView[];
};

export default function StudioShell() {
  const [cells, setCellsRaw] = useState<number[]>(() => PRESETS[0].build());
  const [name, setName] = useState(PRESETS[0].name);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [rateLimit, setRateLimit] = useState<{ remaining: number; limit: number } | null>(null);
  const [toast, setToast] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const setCells = useCallback<Dispatch<SetStateAction<number[]>>>((update) => {
    setCellsRaw(update);
    setDirty(true);
  }, []);

  const say = (tone: "ok" | "bad", text: string) => {
    setToast({ tone, text });
    setTimeout(() => setToast(null), 5000);
  };

  /* ---------------- data ---------------- */

  const { data: meta } = usePoll<Meta>(() => api<Meta>("/api/meta"), 20000);
  const { data: connData, refresh: refreshConnections } = usePoll<{
    connections: ConnectionView[];
    oauth: OAuthConfig;
  }>(() => api<{ connections: ConnectionView[]; oauth: OAuthConfig }>("/api/connections"), 20000);
  const oauth = connData?.oauth ?? null;
  const { data: patternData, refresh: refreshPatterns } = usePoll<{ patterns: PatternView[] }>(
    () => api<{ patterns: PatternView[] }>("/api/patterns"),
    30000,
  );
  const { data: jobsData, refresh: refreshJobs } = usePoll<{ jobs: JobView[] }>(
    () => api<{ jobs: JobView[] }>("/api/jobs"),
    8000,
  );
  const { data: jobDetail, refresh: refreshJob } = usePoll<JobDetail | null>(
    () => (activeJobId ? api<JobDetail>(`/api/jobs/${activeJobId}`) : Promise.resolve(null)),
    2000,
    [activeJobId],
    Boolean(activeJobId),
  );

  const connections = connData?.connections ?? [];
  const connection = useMemo(
    () => connections.find((c) => c.id === activeConnectionId) ?? null,
    [connections, activeConnectionId],
  );
  const jobs = jobsData?.jobs ?? [];
  const savedPatterns = (patternData?.patterns ?? []).filter((p) => p.source !== "demo");

  useEffect(() => {
    if (!activeConnectionId && connections.length) setActiveConnectionId(connections[0].id);
  }, [connections, activeConnectionId]);

  useEffect(() => {
    if (!activeJobId && jobs.length) {
      const running = jobs.find((j) => j.status === "running") ?? jobs[0];
      setActiveJobId(running.id);
    }
  }, [jobs, activeJobId]);

  /* OAuth callback + deep links: ?connected= / ?oauth_error= / ?preset= / ?text= */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const oauthError = params.get("oauth_error");
    const connectionId = params.get("connection_id");
    const wantsGuide = params.get("guide") === "1";
    if (connected) {
      if (connectionId) setActiveConnectionId(connectionId);
      say("ok", `GitHub connected as ${connected}. The painter can now commit on your behalf.`);
    }
    if (oauthError) say("bad", `OAuth failed: ${oauthError}`);
    if (wantsGuide) setGuideOpen(true);
    if (connected || oauthError || wantsGuide) {
      window.history.replaceState({}, "", "/studio");
      void refreshConnections();
    }
    const preset = params.get("preset");
    const text = params.get("text");
    if (preset) {
      const found = PRESETS.find((p) => p.id === preset);
      if (found) {
        setCellsRaw(found.build());
        setName(found.name);
        setDirty(true);
      }
    }
    if (text) {
      setCellsRaw(textToCells(text.toUpperCase().slice(0, 8)));
      setName(text.toUpperCase());
      setDirty(true);
    }
  }, []);

  /* ---------------- actions ---------------- */

  const savePattern = useCallback(async (): Promise<string | null> => {
    setSaving(true);
    try {
      if (savedId) {
        await patch<{ pattern: PatternView }>(`/api/patterns/${savedId}`, { name, cells });
        setDirty(false);
        void refreshPatterns();
        return savedId;
      }
      const res = await post<{ pattern: PatternView }>("/api/patterns", {
        name,
        cells,
        connectionId: activeConnectionId,
        source: "editor",
      });
      setSavedId(res.pattern.id);
      setDirty(false);
      void refreshPatterns();
      return res.pattern.id;
    } catch (err) {
      say("bad", err instanceof Error ? err.message : "could not save the bitmap");
      return null;
    } finally {
      setSaving(false);
    }
  }, [savedId, name, cells, activeConnectionId, refreshPatterns]);

  async function createJob(config: JobConfig) {
    setBusy(true);
    try {
      const patternId = await savePattern();
      if (!patternId) return;
      const res = await post<{ job: JobView }>("/api/jobs", {
        ...config,
        patternId,
        name: `${name} → ${config.mode === "github" ? config.repo || "github" : "simulator"}`,
        connectionId: config.mode === "github" ? activeConnectionId : null,
        autoStart: true,
      });
      setActiveJobId(res.job.id);
      await refreshJobs();
      await refreshJob();
      say(
        "ok",
        config.mode === "github"
          ? `Painter armed against ${res.job.repo}. First tick in ${res.job.intervalSeconds}s.`
          : "Simulated painter armed — watch the log stream.",
      );
    } catch (err) {
      say("bad", err instanceof Error ? err.message : "could not arm the painter");
    } finally {
      setBusy(false);
    }
  }

  async function control(action: "start" | "pause" | "tick" | "reset" | "cancel") {
    if (!activeJobId) return;
    setBusy(true);
    try {
      const res = await post<{ job: JobView; progress: Progress }>(`/api/jobs/${activeJobId}`, { action });
      if ("outcome" in res) {
        const outcome = (res as unknown as { outcome: { status: string; message?: string } }).outcome;
        if (outcome.status === "error") say("bad", outcome.message ?? "tick failed");
      }
      await refreshJob();
      await refreshJobs();
    } catch (err) {
      say("bad", err instanceof Error ? err.message : "control action failed");
    } finally {
      setBusy(false);
    }
  }

  async function patchJob(p: Partial<JobConfig>) {
    if (!activeJobId) return;
    try {
      await patch(`/api/jobs/${activeJobId}`, p);
      await refreshJob();
    } catch (err) {
      say("bad", err instanceof Error ? err.message : "could not update the job");
    }
  }

  async function deleteJob(id: string) {
    setBusy(true);
    try {
      await api(`/api/jobs/${id}`, { method: "DELETE" });
      if (activeJobId === id) setActiveJobId(null);
      await refreshJobs();
      say("ok", "Job deleted.");
    } catch (err) {
      say("bad", err instanceof Error ? err.message : "could not delete the job");
    } finally {
      setBusy(false);
    }
  }

  async function selectJob(id: string) {
    setActiveJobId(id);
    const job = jobs.find((j) => j.id === id);
    if (!job) return;
    try {
      const res = await api<{ pattern: PatternView | null }>(`/api/jobs/${id}`);
      if (res.pattern) {
        setCellsRaw(res.pattern.cells);
        setName(res.pattern.name);
        setSavedId(res.pattern.id);
        setDirty(false);
      }
    } catch {
      /* ignore — the poll will catch up */
    }
  }

  async function loadSavedPattern(p: PatternView) {
    setCellsRaw(p.cells);
    setName(p.name);
    setSavedId(p.id);
    setDirty(false);
  }

  async function loadRepos() {
    if (!activeConnectionId) {
      say("bad", "Connect GitHub first.");
      return;
    }
    setReposLoading(true);
    try {
      const res = await api<{ repos: Repo[]; rateLimit: { remaining: number; limit: number } | null }>(
        `/api/github/repos?connectionId=${activeConnectionId}`,
      );
      setRepos(res.repos);
      setRateLimit(res.rateLimit);
      say("ok", `${res.repos.length} repositories loaded.`);
    } catch (err) {
      say("bad", err instanceof Error ? err.message : "could not list repositories");
    } finally {
      setReposLoading(false);
    }
  }

  const job = jobDetail?.job ?? null;
  const painted = job && job.patternId === savedId ? job.painted : [];
  const litCells = job?.litCells ?? cells.filter((c) => c > 0).length;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 sm:px-6">
      <header className="sticky top-0 z-40 -mx-4 mb-6 border-b border-ink-700/70 bg-ink-950/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Wordmark />
            </Link>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-mist-400 sm:inline">
              / studio
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em]",
                meta?.schedulerOnline
                  ? "border-jade-400/40 bg-jade-400/10 text-jade-300"
                  : "border-rust-400/40 bg-rust-400/10 text-rust-400",
              )}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full bg-current", meta?.schedulerOnline && "animate-blink")}
              />
              scheduler {meta?.schedulerOnline ? "online" : "starting"}
            </span>
            <span className="hidden rounded-full border border-ink-600 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-mist-400 md:inline">
              {meta?.stats.commits ?? 0} commits painted
            </span>
            <ThemeToggle />
            <button
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink-500 bg-ink-850 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mist-200 transition-colors hover:border-acid-400/60 hover:text-acid-300"
            >
              <IconTerminal width={13} height={13} /> how it works
            </button>
            {connection ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-acid-400/40 bg-acid-400/5 py-1 pl-1 pr-3 font-mono text-[10.5px] text-acid-300">
                {connection.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={connection.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
                ) : (
                  <IconGitHub width={13} height={13} />
                )}
                {connection.login}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-mist-400">
                not connected
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mb-5">
        <h1 className="text-[clamp(1.6rem,3.4vw,2.4rem)] font-bold leading-tight tracking-tight text-mist-100">
          Design once. Let the interval do the committing.
        </h1>
        <p className="mt-2 max-w-[86ch] text-[13.5px] leading-relaxed text-mist-400">
          Four stations, left to right: connect an account, draw the bitmap, arm the painter, then
          verify what GitHub actually reports. Everything persists — close the tab and the scheduler
          keeps ticking.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-mist-400">
          <button
            onClick={() => setGuideOpen(true)}
            className="inline-flex items-center gap-1.5 text-acid-300 underline decoration-dotted underline-offset-4 transition-colors hover:text-acid-400"
          >
            <IconTerminal width={12} height={12} /> how the painter works
          </button>
          <span className="text-ink-500">|</span>
          <span>contribution graph = 53×7 bitmap, 5 shades</span>
          <span className="text-ink-500">|</span>
          <span>each shade = a commit count, backdated to that day</span>
        </div>
      </div>

      {toast && (
        <div
          className={cn(
            "mb-4 flex items-start gap-2 rounded-md border p-3 font-mono text-[11.5px]",
            toast.tone === "ok"
              ? "border-jade-400/40 bg-jade-400/5 text-jade-300"
              : "border-red-400/40 bg-red-400/5 text-red-300",
          )}
        >
          {toast.tone === "ok" ? (
            <IconCheck width={14} height={14} className="mt-0.5 shrink-0" />
          ) : (
            <IconWarn width={14} height={14} className="mt-0.5 shrink-0" />
          )}
          {toast.text}
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <ConnectPanel
            connections={connections}
            activeId={activeConnectionId}
            onActive={setActiveConnectionId}
            onChanged={async () => {
              await refreshConnections();
            }}
            oauth={oauth}
            schedulerOnline={meta?.schedulerOnline ?? false}
          />

          <Panel
            title="saved bitmaps"
            subtitle="Every save is reusable by any job on this server."
            right={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCellsRaw(emptyCells());
                  setName("blank canvas");
                  setSavedId(null);
                  setDirty(true);
                }}
              >
                new
              </Button>
            }
          >
            {savedPatterns.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-mist-400">
                Nothing saved yet. Paint something and hit{" "}
                <span className="font-mono text-mist-200">save bitmap</span>.
              </p>
            ) : (
              <ul className="space-y-2">
                {savedPatterns.slice(0, 8).map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => void loadSavedPattern(p)}
                      className={cn(
                        "w-full rounded-md border p-2 text-left transition-colors",
                        p.id === savedId
                          ? "border-acid-400/50 bg-acid-400/5"
                          : "border-ink-700 bg-ink-850/40 hover:border-ink-500",
                      )}
                    >
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <span className="truncate font-mono text-[11px] text-mist-100">{p.name}</span>
                        <span className="shrink-0 font-mono text-[9.5px] text-mist-400">
                          {p.cells.filter((c) => c > 0).length}px
                        </span>
                      </div>
                      <PixelGrid cells={p.cells} compact />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <CanvasPanel
            cells={cells}
            setCells={setCells}
            painted={painted}
            name={name}
            setName={setName}
            savedId={savedId}
            dirty={dirty}
            saving={saving}
            onSave={() => void savePattern()}
            connection={connection}
            anchorDate={job?.anchorDate ?? null}
          />
          <VerifyPanel
            connection={connection}
            designCells={cells}
            repo={job?.repo ?? null}
            onAdopt={(next) => {
              setCells(next);
              setName("sampled calendar");
              setSavedId(null);
              say("ok", "Adopted the live calendar as your design.");
            }}
          />
        </div>

        <div className="space-y-4">
          <SchedulePanel
            job={job}
            progress={jobDetail?.progress ?? null}
            events={jobDetail?.events ?? []}
            jobs={jobs}
            connection={connection}
            litCells={litCells}
            repos={repos}
            reposLoading={reposLoading}
            rateLimit={rateLimit}
            onLoadRepos={() => void loadRepos()}
            onCreate={(config) => void createJob(config)}
            onControl={(action) => void control(action)}
            onPatch={(p) => void patchJob(p)}
            onSelectJob={(id) => void selectJob(id)}
            onDeleteJob={(id) => void deleteJob(id)}
            busy={busy || saving}
          />
          <Panel title="what am i looking at?" subtitle="A 60-second orientation.">
            <ol className="space-y-2 text-[12.5px] leading-relaxed text-mist-300">
              {[
                "Your contribution graph is a 53×7 grid of 371 cells, each with 5 possible shades.",
                "A shade is just a commit count for that day — so a bitmap can be committed onto it.",
                "Draw here (or typeset text, import an image, or sample a real calendar), then save.",
                "Arm the painter: every interval it converts the next few pixels into backdated commits.",
                "Verify pulls the real calendar back out of GitHub and diffs it against your design.",
              ].map((line, i) => (
                <li key={line} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-ink-700 font-mono text-[9px] text-acid-300">
                    {i + 1}
                  </span>
                  {line}
                </li>
              ))}
            </ol>
            <button
              onClick={() => setGuideOpen(true)}
              className="mt-3 w-full rounded-md border border-jade-500/40 bg-jade-500/5 px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-jade-300 transition-colors hover:border-acid-400/60 hover:text-acid-300"
            >
              open the full explanation →
            </button>
            <div className="mt-3 flex items-center gap-2 rounded-md border border-ink-700 bg-ink-950/60 p-2.5 font-mono text-[10.5px] text-mist-400">
              {busy ? (
                <IconSpinner width={12} height={12} className="text-acid-400" />
              ) : (
                <IconBolt width={12} height={12} className="text-acid-400" />
              )}
              {job
                ? `job ${job.id} · ${job.status} · ${job.mode}`
                : "no job armed — the canvas is idle"}
            </div>
          </Panel>
        </div>
      </div>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-ink-700 pt-5">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-mist-400">
          <LogoMini size={13} /> pixelpunisher.x · the interval painter
        </span>
        <span className="font-mono text-[10px] text-mist-400/70">
          © {new Date().getFullYear()} pixelpunisher.x · designed with{" "}
          <span className="text-rust-400">❤</span> by unlike.u
        </span>
      </footer>

      <HowItWorks open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
