import PixelGrid from "@shared/components/PixelGrid";
import { Logo } from "@shared/components/Logo";
import { textToCells } from "@shared/lib/grid";

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-ink-700 pb-2 text-xl font-bold tracking-tight text-mist-100">
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

export default function Guide() {
  return (
    <div>
      <header className="mb-12">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-acid-400">
              documentation
            </div>
            <h1 className="mt-1 text-[clamp(1.8rem,4.4vw,2.8rem)] font-bold leading-[1.02] tracking-[-0.03em] text-mist-100">
              How pixelpunisher.x works
            </h1>
          </div>
        </div>
        <p className="mt-5 max-w-[68ch] text-[15px] leading-relaxed text-mist-300">
          The short version: your contribution graph is a 53×7 bitmap, a shade is a commit count,
          and an interval engine commits your drawing one batch at a time.
        </p>
      </header>

      <div className="space-y-14">
        <section className="space-y-4">
          <H>The core idea</H>
          <P>
            GitHub's contribution graph is drawn from one number per day: how many contributions you
            made. From that number GitHub picks one of five shades. So the graph is a low-resolution
            display — 53 columns, 7 rows, 5 colours — and anything you can draw in 371 pixels, you
            can draw on your profile.
          </P>
          <div className="rounded-lg border border-ink-700 bg-ink-900/60 p-4">
            <PixelGrid cells={textToCells("PAINT")} compact />
            <p className="mt-3 text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-mist-400">
              the word PAINT as a contribution graph
            </p>
          </div>
          <P>
            Internally a pattern is a flat array, column-major:{" "}
            <span className="font-mono text-mist-100">index = week × 7 + day</span>. Each cell holds
            0–4. The editor edits that array, the painter walks it, and the verifier compares it
            against what GitHub reports.
          </P>
        </section>

        <section className="space-y-4">
          <H>Shades → commits</H>
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
                {note ? <div className="mt-1 text-[11px] text-mist-400">{note}</div> : null}
              </div>
            ))}
          </div>
          <P>
            GitHub buckets days into quartiles of your busiest day, so on an already-busy year you
            raise the <strong className="text-mist-100">commit multiplier</strong> in the studio —
            at 3×, a level-4 pixel writes 12 commits and still reads as the darkest shade.
          </P>
        </section>

        <section className="space-y-4">
          <H>Connecting with OAuth</H>
          <P>
            The <strong className="text-mist-100">Authorize with GitHub</strong> button runs the
            standard OAuth authorization-code flow. On Vercel, the code exchange happens inside a
            serverless function so the client secret never reaches the browser:
          </P>
          <Code>{`browser ──▶ github.com/login/oauth/authorize?client_id&scope&state
you approve ──▶ GitHub redirects to /?code=…&state=…
SPA ──▶ POST /api/oauth-exchange { code }          (Vercel Function)
fn  ──▶ POST github.com/login/oauth/access_token
        client_id + client_secret + code  →  access_token
SPA stores the token locally and calls api.github.com directly`}</Code>
          <P>
            Two fallbacks need no server at all: the <strong className="text-mist-100">device
            flow</strong> (you type a code at github.com/login/device; the SPA polls for the token)
            and a pasted <strong className="text-mist-100">personal access token</strong>. Scopes
            are <span className="font-mono">repo read:user user:email</span> — the email scope
            matters, because commits only count when authored with a verified address.
          </P>
        </section>

        <section className="space-y-4">
          <H>Inside a tick</H>
          <P>
            No git binary, no clone. Commits are assembled as raw git objects through the Git Data
            API and published with a single ref update, so a tick lands atomically:
          </P>
          <Code>{`GET   /repos/{owner}/{repo}/git/ref/heads/{branch}   → head sha
POST  /repos/{owner}/{repo}/git/blobs                → the manifest file
POST  /repos/{owner}/{repo}/git/trees                → base_tree = head
POST  /repos/{owner}/{repo}/git/commits              → author.date = the pixel's day
      …repeated per commit, each chained onto the last…
PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}  → move the branch once`}</Code>
          <P>
            In this Vite edition the interval engine runs in your tab (keep it open, or use the
            Next.js edition whose scheduler runs server-side in Postgres). Future-dated pixels are
            clamped to "now", because GitHub won't count commits from the future. Each commit costs
            about two API calls against your 5,000/hour budget.
          </P>
        </section>

        <section className="space-y-4">
          <H>Limits &amp; safety</H>
          <div className="space-y-2.5">
            {[
              [
                "Why a dedicated repo",
                "Only commits on a standalone (non-fork) repository's default branch reach the graph. The painter creates <you>-pixels for you and never touches your other projects.",
              ],
              [
                "Reversibility",
                "Everything lives in one repository and one manifest file. Delete the repo and the pixels disappear from your graph.",
              ],
              [
                "Token handling",
                "In this static edition your token lives in your browser's localStorage — treat it like a password and disconnect when you're done. The Next.js edition encrypts tokens server-side instead.",
              ],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-ink-700 bg-ink-900/50 p-4">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-acid-300">{title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-mist-300">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
