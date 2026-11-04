import type { Metadata } from "next";
import Link from "next/link";
import PixelGrid from "@/components/PixelGrid";
import { Wordmark } from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { PRESETS, textToCells } from "@/lib/grid";

export const metadata: Metadata = {
  title: "How it works — pixelpunisher.x",
  description:
    "The full explanation: how a contribution graph becomes a 53×7 bitmap, how OAuth connects your account, and how the interval painter commits it pixel by pixel.",
};

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 border-b border-ink-700 pb-2 text-xl font-bold tracking-tight text-mist-100"
    >
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] leading-relaxed text-mist-300">{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-ink-700 bg-ink-950 p-3.5 font-mono text-[11.5px] leading-[1.85] text-mist-200">
      {children}
    </pre>
  );
}

function Note({ children, tone = "jade" }: { children: React.ReactNode; tone?: "jade" | "rust" }) {
  return (
    <div
      className={`rounded-md border p-3 text-[12.5px] leading-relaxed ${
        tone === "jade"
          ? "border-jade-500/40 bg-jade-500/5 text-mist-300"
          : "border-rust-400/30 bg-rust-400/5 text-mist-300"
      }`}
    >
      {children}
    </div>
  );
}

const TOC = [
  ["concept", "The core idea"],
  ["grid", "The grid model"],
  ["levels", "Shades → commits"],
  ["oauth", "The OAuth connection"],
  ["scheduler", "The interval painter"],
  ["commits", "Inside a tick"],
  ["verify", "Closing the loop"],
  ["limits", "Limits & safety"],
  ["api", "API reference"],
];

export default function GuidePage() {
  const sample = textToCells("PAINT");

  return (
    <main className="mx-auto w-full max-w-[1000px] px-5 pb-28 sm:px-8">
      <nav className="sticky top-0 z-40 -mx-5 mb-10 border-b border-ink-700/70 bg-ink-950/85 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link
              href="/studio"
              className="rounded-md bg-acid-400 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-950 transition-colors hover:bg-acid-300"
            >
              open studio
            </Link>
          </div>
        </div>
      </nav>

      <header className="mb-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-acid-400">
          documentation
        </div>
        <h1 className="mt-3 text-[clamp(2rem,5vw,3.2rem)] font-bold leading-[1.02] tracking-[-0.03em] text-mist-100">
          How pixelpunisher.x works
        </h1>
        <p className="mt-5 max-w-[68ch] text-[15px] leading-relaxed text-mist-300">
          Everything below is also available inside the studio — press{" "}
          <span className="font-mono text-mist-100">how it works</span> in the header at any time.
          This page is the long version.
        </p>
        <nav className="mt-7 flex flex-wrap gap-2">
          {TOC.map(([id, label], i) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-md border border-ink-600 bg-ink-900 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-mist-300 transition-colors hover:border-acid-400/60 hover:text-acid-300"
            >
              <span className="mr-1.5 text-ink-500">{String(i + 1).padStart(2, "0")}</span>
              {label}
            </a>
          ))}
        </nav>
      </header>

      <div className="space-y-14">
        {/* concept */}
        <section className="space-y-4">
          <H id="concept">The core idea</H>
          <P>
            GitHub's contribution graph is drawn from a very small amount of data: for every day, a
            count of contributions. From that one number GitHub picks one of five shades. That's it.
          </P>
          <P>
            Which means the graph isn't really a chart — it's a{" "}
            <strong className="text-mist-100">low-resolution display</strong>. 53 columns, 7 rows,
            5 colours. And any display can be drawn on, provided you can control the underlying
            numbers.
          </P>
          <P>
            pixelpunisher.x is a plotter for that display. You compose a bitmap, the tool converts each
            pixel into a number of commits dated on that calendar day, and an interval scheduler
            drips them out over minutes, hours or days — so the picture develops on your profile the
            way a photograph develops in a tray.
          </P>
          <div className="rounded-lg border border-ink-700 bg-ink-900/60 p-4">
            <PixelGrid cells={sample} compact />
            <p className="mt-3 text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-mist-400">
              the word PAINT as a contribution graph
            </p>
          </div>
        </section>

        {/* grid */}
        <section className="space-y-4">
          <H id="grid">The grid model</H>
          <P>
            Internally a pattern is a flat array of numbers, stored column-major:{" "}
            <span className="font-mono text-mist-100">index = week × 7 + day</span>. Week 1 is the
            leftmost column, day 1 is Sunday. Each value is 0–4.
          </P>
          <Code>{`cells[0]   // week 1, Sunday
cells[1]   // week 1, Monday
…
cells[7]   // week 2, Sunday
cells[370] // week 53, Saturday

53 weeks × 7 days = 371 cells`}</Code>
          <P>
            A pattern stores its own <em>anchor date</em> — the Sunday its first column starts on.
            The painter derives every cell's date as{" "}
            <span className="font-mono text-mist-100">anchor + week×7 days + day</span>, so the same
            bitmap can be replayed onto any year.
          </P>
          <P>
            That array is the single source of truth. The editor edits it, the scheduler walks it,
            and the verification step compares it against what GitHub reports. Everything else —
            presets, the pixel font, image import, calendar sampling — is just a way of producing
            that array.
          </P>
        </section>

        {/* levels */}
        <section className="space-y-4">
          <H id="levels">Shades → commits</H>
          <P>
            GitHub assigns a level by comparing a day's count against the distribution of your whole
            year, so the thresholds move. In practice, on a quiet year, one commit is enough for the
            first quartile and four will max a day out. The painter therefore writes a fixed number
            of commits per level, and lets you scale it if your year is already busy.
          </P>
          <div className="grid gap-2.5 sm:grid-cols-5">
            {[
              [0, "0 commits", "leave the day alone"],
              [1, "1 commit", "faintest"],
              [2, "2 commits", ""],
              [3, "3 commits", ""],
              [4, "4 commits", "darkest"],
            ].map(([level, commits, note]) => (
              <div key={String(level)} className="rounded-lg border border-ink-700 bg-ink-850/60 p-3">
                <div className={`cell-${level} h-10 rounded border border-ink-600/60`} />
                <div className="mt-2.5 flex items-baseline justify-between">
                  <span className="font-mono text-lg text-mist-100 tabular-nums">{level}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-acid-300">
                    {commits}
                  </span>
                </div>
                {note && <div className="mt-1 text-[11px] text-mist-400">{note}</div>}
              </div>
            ))}
          </div>
          <Code>{`commits_for_level(level, multiplier)
  level 0 → 0      // skipped entirely
  level 1 → 1 × multiplier
  level 4 → 4 × multiplier`}</Code>
          <Note>
            The <strong className="text-mist-100">commit multiplier</strong> in step 3 is the answer
            to "my graph is already green". At 3× a level-4 pixel writes 12 commits that day, which
            will still read as the darkest shade.
          </Note>
        </section>

        {/* oauth */}
        <section className="space-y-4">
          <H id="oauth">The OAuth connection</H>
          <P>
            The <strong className="text-mist-100">Authorize with GitHub</strong> button runs the
            standard OAuth 2.0 authorization-code flow. Your token never touches the browser.
          </P>
          <Code>{`┌──────────┐  1. GET /api/auth/github/start        ┌────────┐
│  browser │ ───────────────────────────────────▶ │  this  │
│          │      302 + signed state cookie       │  app   │
│          │                                      └───┬────┘
│          │  2. redirect to github.com/login/oauth/authorize
│          │ ────────────────────────────────────────────▶ GitHub
│          │      client_id · redirect_uri · scope · state
│          │◀──────────────────────────────────────────── GitHub
│          │  3. you click "Authorize" — GitHub redirects to
│          │     /api/auth/github/callback?code=…&state=…
│          │ ────────────────────────────────────────────▶ GitHub
│          │                                      ┌───┴────┐
│  browser │  5. redirect to /studio?connected=…  │  this  │
│          │ ◀─────────────────────────────────── │  app   │
└──────────┘                                      └───┬────┘
      step 4 happens server-side, invisible to the browser:
      POST github.com/login/oauth/access_token
           client_id + client_secret + code + redirect_uri
           → { access_token }`}</Code>
          <ol className="space-y-2.5 text-[13px] leading-relaxed text-mist-300">
            {[
              <>
                <strong className="text-mist-100">You start.</strong> The app builds an
                authorization URL containing its client id, the callback URL, the requested scopes
                and a random <span className="font-mono">state</span> value signed with HMAC and
                dropped into an httpOnly cookie.
              </>,
              <>
                <strong className="text-mist-100">You approve on GitHub.</strong> GitHub shows the
                permission screen for <span className="font-mono">repo</span>,{" "}
                <span className="font-mono">read:user</span> and{" "}
                <span className="font-mono">user:email</span>, then sends your browser back with a
                one-time <span className="font-mono">code</span>.
              </>,
              <>
                <strong className="text-mist-100">State is verified.</strong> The callback checks the
                state against the cookie. If they don't match, the flow is rejected — that's what
                stops a cross-site request from connecting an attacker's GitHub to your session.
              </>,
              <>
                <strong className="text-mist-100">The code is exchanged.</strong> The server POSTs
                the code together with the client secret to GitHub. Only the server holds the
                secret, and only the server sees the resulting access token.
              </>,
              <>
                <strong className="text-mist-100">The token is sealed.</strong> It's encrypted with
                AES-256-GCM and written to Postgres, so the scheduler can use it later without you
                being logged in. Your browser only ever receives your login name and avatar.
              </>,
            ].map((line, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-ink-700 font-mono text-[10px] text-acid-300">
                  {i + 1}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
          <P>
            Scopes: <span className="font-mono text-mist-100">repo</span> lets the painter create
            commits; <span className="font-mono text-mist-100">read:user</span> resolves who you
            are; <span className="font-mono text-mist-100">user:email</span> is the important one —
            commits only count on the graph when they're attributed to an address verified on your
            account, so the painter looks up your primary verified email before it commits anything.
          </P>
          <Note tone="rust">
            <strong className="text-mist-100">Where do the credentials come from?</strong> Either the{" "}
            <span className="font-mono">GITHUB_CLIENT_ID</span> /{" "}
            <span className="font-mono">GITHUB_CLIENT_SECRET</span> environment variables, or the
            Client ID and Secret you paste into step 1 of the studio. The panel shows you the exact
            callback URL to register on your OAuth App, because GitHub requires an exact match. Two
            alternatives are built in as fallbacks: the <em>device flow</em> (also OAuth, but you
            type a code at github.com/login/device — no callback URL or secret needed) and a pasted
            personal access token.
          </Note>
        </section>

        {/* scheduler */}
        <section className="space-y-4">
          <H id="scheduler">The interval painter</H>
          <P>
            A paint job is a persisted plan: <em>this pattern, walked in this order, this many cells
            per tick, every N seconds, into this repository</em>. Nothing about it lives in your
            browser.
          </P>
          <Code>{`sweep()  ── runs on the server every 4 seconds
│
├─ SELECT * FROM jobs
│    WHERE status = 'running'
│      AND (next_tick_at IS NULL OR next_tick_at <= now())
│
├─ for each due job:
│    ordered   = paint_order(pattern.cells, job.order)   // the walk
│    remaining = ordered minus job.painted               // not yet committed
│    batch     = remaining.take(job.cells_per_tick)
│
│    for each cell in batch:
│      date    = anchor + week·7 days + day  (clamped to "now")
│      commits = commits_for_level(level, multiplier)
│      → build that many commit objects, author.date = date
│
│    push the whole batch by moving the branch ref once
│    log an event · cells_painted += batch.length
│    next_tick_at = now() + interval_seconds
│
└─ done when remaining is empty → status = 'done'`}</Code>
          <P>
            The <strong className="text-mist-100">paint order</strong> changes the character of the
            result. Column order sweeps left to right like a printer head. Row order fills in one
            weekday at a time. Intensity order commits all your darkest pixels first. Spiral blooms
            out from the middle of the year. Random looks like noise resolving into a picture.
          </P>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["30s", "a sprint — the bitmap appears in minutes", "acid"],
              ["15m", "the default — a slow, believable drip", "jade"],
              ["6h", "a fortnight-long development", "rust"],
            ].map(([interval, note, tone]) => (
              <div key={interval} className="rounded-lg border border-ink-700 bg-ink-850/50 p-3.5">
                <div
                  className={`font-mono text-xl ${
                    tone === "acid"
                      ? "text-acid-400"
                      : tone === "jade"
                        ? "text-jade-300"
                        : "text-rust-400"
                  }`}
                >
                  {interval}
                </div>
                <div className="mt-1.5 text-[12px] leading-snug text-mist-400">{note}</div>
              </div>
            ))}
          </div>
          <P>
            Because state lives in the database, pausing is free: the painted set is remembered, and
            resuming carries on exactly where it stopped. Reset wipes the painted set so the same
            bitmap can be plotted again.
          </P>
        </section>

        {/* commits */}
        <section className="space-y-4">
          <H id="commits">Inside a tick</H>
          <P>
            No <span className="font-mono">git</span> binary, no clone, no working tree. Commits are
            assembled as raw git objects through GitHub's Git Data API and published with a single
            ref update, so a tick is atomic from the graph's point of view.
          </P>
          <Code>{`GET   /repos/{owner}/{repo}/git/ref/heads/{branch}   → head sha
      (if the branch doesn't exist yet: create blob + tree +
       parentless commit + ref — seeding the canvas)

POST  /repos/{owner}/{repo}/git/blobs                → the manifest file
POST  /repos/{owner}/{repo}/git/trees                → base_tree = head
POST  /repos/{owner}/{repo}/git/commits              → {
        message: "paint: w12/d4 · level 3",
        tree:     <tree sha>,
        parents:  [ <previous commit> ],
        author:      { name, email, date: "2026-03-11T12:20:00Z" },
        committer:   { name, email, date: "2026-03-11T12:20:00Z" }
      }
      …repeated for every commit in the batch, each chained onto the last…

PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}  → { sha: <new head> }`}</Code>
          <P>
            Every commit is a genuine object with a real SHA and real contents. The only thing
            that's engineered is the <strong className="text-mist-100">author date</strong>, which
            is precisely the field the contribution graph reads. All the commits in a tick touch
            the same manifest file, so each tick advances the branch by a clean chain of commits.
          </P>
          <Note tone="rust">
            <strong className="text-mist-100">Future dates are clamped.</strong> GitHub ignores (and
            sometimes rejects) commits dated after now. If part of your bitmap falls later this week,
            those pixels are committed immediately rather than being dropped — the tick log notes how
            many were clamped.
          </Note>
          <P>
            The manifest file doubles as a progress record: it lists the pattern name, how many cells
            are committed, and one line per cell in the batch with its week, day, level and commit
            count. You can download the whole plan as CSV from step 3 —{" "}
            <span className="font-mono">commit plan</span> — before you commit anything.
          </P>
        </section>

        {/* verify */}
        <section className="space-y-4">
          <H id="verify">Closing the loop</H>
          <P>
            Step 4 is the proof. It runs GitHub's GraphQL{" "}
            <span className="font-mono text-mist-100">contributionCalendar</span> query with your
            token and flattens the returned weeks back into the same 53×7 array the editor uses.
          </P>
          <Code>{`query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            contributionLevel   # NONE | FIRST_QUARTILE | … | FOURTH_QUARTILE
            date
          }
        }
      }
    }
  }
}`}</Code>
          <P>
            Your design and the reported calendar are then compared cell by cell. Any cell where
            they disagree is outlined in rust, and a match percentage is shown — so you can watch
            accuracy climb toward 100% as the painter works, and see exactly which pixels are still
            pending. You can also adopt the live calendar as your design, which is how you remix a
            real year's shape into something else.
          </P>
        </section>

        {/* limits */}
        <section className="space-y-4">
          <H id="limits">Limits &amp; safety</H>
          <div className="space-y-2.5">
            {[
              [
                "Rate limit",
                "Each commit costs about two API calls, and a user token gets 5,000 per hour. The default 6 cells per tick at a 15-minute interval is roughly 100 calls/hour. Step 1 shows your remaining quota once connected, and step 3 estimates a job's total call count before you arm it.",
              ],
              [
                "Why a dedicated repo",
                "Only commits on a standalone (non-fork) repository's default branch reach the graph. The painter will create <you>-pixels for you; the repo picker flags forks because they will never count.",
              ],
              [
                "Reversibility",
                "Everything lives in one repository. Delete it and the pixels disappear from your graph — nothing in your other projects is ever touched.",
              ],
              [
                "Token handling",
                "Tokens are encrypted at rest with AES-256-GCM and never sent to the browser. Disconnecting a connection deletes its token and its jobs.",
              ],
              [
                "Simulate mode",
                "Runs the identical scheduler, ordering and logging against a virtual canvas. Zero GitHub calls, zero risk — use it to rehearse a design, or to watch the mechanics if you'd rather not connect anything.",
              ],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-ink-700 bg-ink-900/50 p-4">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-acid-300">
                  {title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-mist-300">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* api */}
        <section className="space-y-4">
          <H id="api">API reference</H>
          <P>Everything the studio does is a plain JSON endpoint — script it if you like.</P>
          <div className="overflow-hidden rounded-lg border border-ink-700">
            {[
              ["GET", "/api/health", "liveness probe"],
              ["GET", "/api/meta", "scheduler status, OAuth status, global counters"],
              ["GET/POST/DELETE", "/api/auth/github/config", "read / save / clear OAuth App credentials"],
              ["GET", "/api/auth/github/start", "begin the OAuth redirect flow"],
              ["GET", "/api/auth/github/callback", "OAuth callback — exchanges the code"],
              ["POST", "/api/auth/device/start", "begin the device flow"],
              ["POST", "/api/auth/device/poll", "poll the device flow for a token"],
              ["POST", "/api/auth/token", "connect with a personal access token"],
              ["GET", "/api/connections", "list connections + OAuth status"],
              ["DELETE", "/api/connections/:id", "remove a connection and its jobs"],
              ["GET", "/api/github/repos", "list your repositories + quota"],
              ["POST", "/api/github/repo", "create the pixel repository"],
              ["GET", "/api/github/contributions", "read a contribution calendar as a bitmap"],
              ["GET/POST", "/api/patterns", "list / create bitmaps"],
              ["GET/PATCH/DELETE", "/api/patterns/:id", "read / update / delete a bitmap"],
              ["GET/POST", "/api/jobs", "list / arm paint jobs"],
              ["GET/PATCH/DELETE", "/api/jobs/:id", "inspect / reconfigure / delete a job"],
              ["POST", "/api/jobs/:id", "control: start · pause · tick · reset · cancel"],
              ["GET", "/api/jobs/:id/plan", "the full commit plan as CSV"],
              ["GET", "/api/demo", "the public self-painting demo job"],
            ].map(([method, path, desc]) => (
              <div
                key={path + method}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ink-700/60 bg-ink-900/40 px-3.5 py-2.5 last:border-0"
              >
                <span className="w-[150px] shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-jade-300">
                  {method}
                </span>
                <span className="font-mono text-[11.5px] text-mist-100">{path}</span>
                <span className="basis-full pl-0 text-[11.5px] text-mist-400 sm:basis-auto sm:pl-3">
                  {desc}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* presets */}
        <section className="space-y-4">
          <H id="presets">The pattern library</H>
          <P>
            Twelve presets ship built-in, each a deterministic function that returns a 371-cell
            array. Hover any of them on the landing page to preview it.
          </P>
          <div className="grid gap-3 sm:grid-cols-2">
            {PRESETS.map((p) => (
              <div key={p.id} className="rounded-lg border border-ink-700 bg-ink-900/50 p-3">
                <PixelGrid cells={p.build()} compact />
                <div className="mt-2.5 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-mist-200">
                    {p.name}
                  </span>
                  <span className="font-mono text-[9.5px] text-mist-400">{p.id}</span>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-snug text-mist-400">{p.blurb}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-ink-700 pt-8">
        <div>
          <p className="font-mono text-[11px] text-mist-400">
            pixelpunisher.x — backdated commits as pixels. Paint responsibly: use a dedicated repo.
          </p>
          <p className="mt-1.5 font-mono text-[10.5px] text-mist-400/70">
            © {new Date().getFullYear()} pixelpunisher.x · designed with{" "}
            <span className="text-rust-400">❤</span> by unlike.u
          </p>
        </div>
        <Link
          href="/studio"
          className="rounded-md bg-acid-400 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-950 transition-colors hover:bg-acid-300"
        >
          start painting →
        </Link>
      </footer>
    </main>
  );
}
