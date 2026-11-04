"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { IconCheck, IconTerminal, IconWarn } from "./Icons";

type Section = {
  id: string;
  title: string;
  body: React.ReactNode;
};

const SECTIONS: Section[] = [
  {
    id: "grid",
    title: "1 · The graph is a bitmap",
    body: (
      <>
        <p>
          A GitHub contribution graph is a grid of <strong>53 columns</strong> (ISO weeks) ×{" "}
          <strong>7 rows</strong> (Sunday → Saturday) — 371 cells. Each cell is shaded one of five
          ways, based on how many commits were authored that day.
        </p>
        <p>
          So the graph is really a <strong>53×7, 5-colour bitmap</strong>, and anything you can draw
          in 371 pixels you can draw on your profile.
        </p>
        <div className="my-3 grid grid-cols-5 gap-1.5">
          {[0, 1, 2, 3, 4].map((l) => (
            <div key={l} className={`cell-${l} h-9 rounded border border-ink-600/60`} />
          ))}
        </div>
        <p className="font-mono text-[11px] text-mist-400">
          level 0 = empty · 1–4 = increasingly dark quartiles
        </p>
      </>
    ),
  },
  {
    id: "levels",
    title: "2 · A shade is a commit count",
    body: (
      <>
        <p>
          GitHub buckets each day against the busiest day of your year. Writing{" "}
          <strong>N commits</strong> on a day puts it in the Nth quartile. The painter maps each
          pixel's level straight onto a commit count:
        </p>
        <ul className="my-3 space-y-1.5 font-mono text-[11.5px]">
          {[
            ["level 0", "0 commits", "day left alone"],
            ["level 1", "1 commit", "faintest green"],
            ["level 2", "2 commits", ""],
            ["level 3", "3 commits", ""],
            ["level 4", "4 commits", "darkest green"],
          ].map(([a, b, c]) => (
            <li key={a} className="flex justify-between gap-3 border-b border-ink-700/70 pb-1.5">
              <span className="text-mist-200">{a}</span>
              <span className="text-acid-300">
                {b} {c && <span className="text-mist-400">· {c}</span>}
              </span>
            </li>
          ))}
        </ul>
        <p>
          If your year is already busy, raise the <strong>commit multiplier</strong> in step 3 — a 2×
          multiplier writes 2, 4, 6 and 8 commits so your pixels still stand out.
        </p>
      </>
    ),
  },
  {
    id: "oauth",
    title: "3 · Connecting with OAuth",
    body: (
      <>
        <p>
          The <strong>Authorize with GitHub</strong> button is the standard OAuth
          authorization-code flow:
        </p>
        <ol className="mt-2.5 space-y-1.5 pl-1 text-[12.5px]">
          {[
            "Your browser is sent to github.com/login/oauth/authorize with the app's client id, the requested scopes and a signed state value.",
            "You approve. GitHub redirects back to /api/auth/github/callback with a one-time code.",
            "The server verifies the state cookie, then POSTs the code plus the client secret to GitHub to exchange it for a user access token.",
            "The token is encrypted with AES-256-GCM and stored, so the scheduler can keep painting while you're offline.",
          ].map((line, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-ink-700 font-mono text-[9px] text-acid-300">
                {i + 1}
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3">
          Scopes requested are <span className="font-mono text-mist-200">repo</span>,{" "}
          <span className="font-mono text-mist-200">read:user</span> and{" "}
          <span className="font-mono text-mist-200">user:email</span>. The email scope matters: your
          commits must be attributed to a <em>verified</em> address or they won't appear on the graph
          at all.
        </p>
        <p className="mt-2">
          The app credentials come from <span className="font-mono text-mist-200">GITHUB_CLIENT_ID</span>{" "}
          / <span className="font-mono text-mist-200">GITHUB_CLIENT_SECRET</span> env vars, or from
          the Client ID + Secret you paste into step 1 — which is why the panel shows you the exact
          callback URL to register.
        </p>
      </>
    ),
  },
  {
    id: "scheduler",
    title: "4 · The interval painter",
    body: (
      <>
        <p>
          A job is just a plan: <em>this bitmap, in this order, this many cells, every N seconds,
          into this repo</em>. A scheduler on the server wakes every <strong>4 seconds</strong> and
          runs any job whose <span className="font-mono text-mist-200">next_tick_at</span> is due.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md border border-ink-700 bg-ink-950 p-3 font-mono text-[11px] leading-relaxed text-mist-200">
{`while (true) { every 4s
  jobs = SELECT * WHERE status='running'
              AND next_tick_at <= now()
  for (job of jobs) {
    batch = next unpainted cells (max cells_per_tick)
    for each cell → commits with that day's author date
    push the whole batch with ONE ref update
    log it · set next_tick_at = now() + interval
  }
}`}
        </pre>
        <p className="mt-3">
          Nothing runs in your browser. Close the tab, log out, turn off your laptop — the painter
          keeps ticking until the bitmap is finished or you pause it.
        </p>
      </>
    ),
  },
  {
    id: "commits",
    title: "5 · What a tick actually does",
    body: (
      <>
        <p>
          There's no <span className="font-mono">git</span> binary and no clone. Commits are built as
          raw git objects through GitHub's <strong>Git Data API</strong>:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md border border-ink-700 bg-ink-950 p-3 font-mono text-[11px] leading-[1.9] text-mist-200">
{`POST  /git/blobs    → the pixel manifest file
POST  /git/trees    → base_tree = current head
POST  /git/commits  → author.date = the pixel's day
                     (parent = previous commit)
  … once per commit in the batch …
PATCH /git/refs     → move the branch once, atomically`}
        </pre>
        <p className="mt-3">
          Every commit is a real object with a real SHA. The only thing that's engineered is the{" "}
          <span className="font-mono text-mist-200">author date</span>, which is what the
          contribution graph reads. That's why the whole batch is published with a single ref move —
          a tick either lands completely or not at all.
        </p>
        <div className="mt-3 flex gap-2 rounded-md border border-rust-400/30 bg-rust-400/5 p-2.5">
          <IconWarn width={14} height={14} className="mt-0.5 shrink-0 text-rust-400" />
          <p className="text-[11.5px] leading-relaxed text-mist-300">
            Each commit costs ~2 API calls, and you get 5,000/hour. The default 6 cells per tick at a
            15-minute interval uses roughly 100 calls/hour. Dates in the future are pulled back to
            "now", because GitHub won't count them.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "rules",
    title: "6 · Why a dedicated repo",
    body: (
      <>
        <ul className="space-y-2 text-[12.5px]">
          {[
            "Only commits on a standalone repository's default branch reach the graph — forks are excluded, which is why the repo picker flags them.",
            "The commits must be authored with an email verified on your account, so the painter resolves your primary verified address first.",
            "Everything lands in one text file (.paint/pixels.txt by default), so your repo stays readable and the manifest doubles as a progress record.",
            "Delete the repo and the pixels vanish with it — nothing else is touched.",
          ].map((line) => (
            <li key={line} className="flex gap-2.5">
              <IconCheck width={14} height={14} className="mt-0.5 shrink-0 text-acid-400" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11.5px] leading-relaxed text-mist-400">
          Simulate mode runs the identical scheduler, ordering and logging against a virtual canvas —
          use it to rehearse a design before spending API quota.
        </p>
      </>
    ),
  },
];

export default function HowItWorks({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [active, setActive] = useState(SECTIONS[0].id);
  const current = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-[560px] flex-col border-l border-ink-600 bg-ink-900 shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-700 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-acid-400">
              <IconTerminal width={13} height={13} /> how this works
            </div>
            <h2 className="mt-1.5 text-lg text-mist-100">
              From bitmap to contribution graph
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-ink-600 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mist-300 transition-colors hover:border-rust-400/50 hover:text-rust-400"
          >
            close
          </button>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-ink-700 px-4 py-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "shrink-0 rounded px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] transition-colors",
                active === s.id
                  ? "bg-ink-700 text-acid-300"
                  : "text-mist-400 hover:bg-ink-800 hover:text-mist-200",
              )}
            >
              {s.id}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <h3 className="font-mono text-[12px] uppercase tracking-[0.16em] text-mist-100">
            {current.title}
          </h3>
          <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-mist-300">
            {current.body}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-ink-700 pt-4">
            <Link
              href="/guide"
              className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-jade-300 transition-colors hover:text-acid-300"
            >
              full documentation →
            </Link>
            <div className="flex gap-2">
              {SECTIONS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setActive(SECTIONS[Math.max(0, i - 1)].id)}
                  disabled={i === 0}
                  className="rounded border border-ink-600 px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-mist-400 disabled:opacity-30 hover:text-mist-100"
                >
                  prev
                </button>
              ))}
              <button
                onClick={() =>
                  setActive(SECTIONS[Math.min(SECTIONS.length - 1, SECTIONS.indexOf(current) + 1)].id)
                }
                disabled={SECTIONS.indexOf(current) === SECTIONS.length - 1}
                className="rounded border border-ink-600 px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-mist-400 disabled:opacity-30 hover:text-mist-100"
              >
                next
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
