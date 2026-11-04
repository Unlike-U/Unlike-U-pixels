"use client";

import { useMemo, useState } from "react";
import PixelGrid from "@/components/PixelGrid";
import { Button, Panel, Stat, TextInput } from "@/components/ui";
import { IconGitHub, IconSpinner, IconWand } from "@/components/Icons";
import { api, timeAgo } from "@/lib/client";
import type { ConnectionView } from "@/lib/client";
import { COLS, ROWS, summarize } from "@/lib/grid";
import { cn } from "@/lib/cn";

type Response = {
  login: string;
  total: number;
  weeks: number;
  cells: number[];
  calendar: { level: number; count: number; date: string }[][];
};

export default function VerifyPanel({
  connection,
  designCells,
  onAdopt,
  repo,
}: {
  connection: ConnectionView | null;
  designCells: number[];
  onAdopt: (cells: number[]) => void;
  repo: string | null;
}) {
  const [login, setLogin] = useState("");
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const target = (login || connection?.login || "").trim();

  const diff = useMemo(() => {
    if (!data) return null;
    let match = 0;
    let mismatch = 0;
    for (let i = 0; i < COLS * ROWS; i++) {
      const a = Math.max(0, Math.min(4, Math.round(data.cells[i] ?? 0)));
      const b = Math.max(0, Math.min(4, Math.round(designCells[i] ?? 0)));
      if (a === b) match++;
      else mismatch++;
    }
    return { match, mismatch, accuracy: Math.round((match / (COLS * ROWS)) * 100) };
  }, [data, designCells]);

  async function fetchCalendar() {
    if (!connection) {
      setError("Connect a GitHub account first — the calendar query needs a token.");
      return;
    }
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<Response>(
        `/api/github/contributions?connectionId=${connection.id}&login=${encodeURIComponent(target)}`,
      );
      setData(res);
      setFetchedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not read the calendar");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const actualStats = data ? summarize(data.cells) : null;
  const designStats = summarize(designCells);

  return (
    <Panel
      step="4"
      title="verify against github"
      subtitle="Pull the real contribution calendar back out of GraphQL and diff it against your design."
      right={
        fetchedAt ? (
          <span className="font-mono text-[10px] text-mist-400">fetched {timeAgo(fetchedAt)}</span>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[180px] flex-1">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-mist-400">
            github login
          </span>
          <TextInput
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder={connection?.login ?? "octocat"}
            onKeyDown={(e) => e.key === "Enter" && void fetchCalendar()}
          />
        </label>
        <Button
          variant="acid"
          onClick={() => void fetchCalendar()}
          disabled={loading || !connection}
          icon={
            loading ? <IconSpinner width={14} height={14} /> : <IconGitHub width={14} height={14} />
          }
        >
          {loading ? "reading…" : "fetch calendar"}
        </Button>
        {data && (
          <Button onClick={() => onAdopt(data.cells)} icon={<IconWand width={14} height={14} />}>
            adopt as design
          </Button>
        )}
        {repo && (
          <a
            href={`https://github.com/${repo}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-ink-500 bg-ink-850 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-mist-200 transition-colors hover:border-jade-300/60"
          >
            open repo ↗
          </a>
        )}
      </div>

      {!connection && (
        <p className="mt-3 rounded-md border border-ink-700 bg-ink-850/50 p-3 text-[12px] leading-relaxed text-mist-400">
          The contribution calendar is only readable with an authenticated token. Connect in step 1 —
          or keep painting in simulate mode, which needs nothing.
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-md border border-red-400/30 bg-red-400/5 p-2.5 font-mono text-[11px] text-red-300">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist-400">
              your design
            </span>
            <span className="font-mono text-[10px] text-acid-300">{designStats.lit} lit</span>
          </div>
          <div className="rounded-md border border-ink-700 bg-ink-950/60 p-2.5">
            <PixelGrid cells={designCells} compact />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist-400">
              github reports
            </span>
            <span className="font-mono text-[10px] text-jade-300">
              {data ? `${data.total} contributions` : "not fetched"}
            </span>
          </div>
          <div
            className={cn(
              "rounded-md border bg-ink-950/60 p-2.5",
              data ? "border-jade-500/40" : "border-ink-700",
            )}
          >
            {data ? (
              <PixelGrid cells={data.cells} overlay={designCells} compact />
            ) : (
              <div className="hatch flex h-[74px] items-center justify-center rounded font-mono text-[10.5px] text-mist-400">
                awaiting a fetch
              </div>
            )}
          </div>
        </div>
      </div>

      {data && diff && actualStats && (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="match" value={`${diff.accuracy}%`} accent />
          <Stat label="cells matching" value={diff.match} sub={`of ${COLS * ROWS}`} />
          <Stat label="mismatched" value={diff.mismatch} sub="outlined in rust above" />
          <Stat
            label="actual lit days"
            value={actualStats.lit}
            sub={`${data.calendar.length} weeks returned`}
          />
        </div>
      )}
    </Panel>
  );
}
