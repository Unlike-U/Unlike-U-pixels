import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import LiveCanvas from "@/components/LiveCanvas";
import { Wordmark } from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import PresetGallery from "@/components/PresetGallery";
import {
  IconBolt,
  IconBrush,
  IconCheck,
  IconClock,
  IconGitHub,
  IconGrid,
  IconLayers,
  IconTerminal,
} from "@/components/Icons";

type Step = {
  n: string;
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconSize?: number;
  body: string;
};

const STEPS: Step[] = [
  {
    n: "01",
    title: "Draw the bitmap",
    icon: IconBrush,
    body: "A contribution graph is a 53 × 7 grid — 371 pixels with five intensities. Paint it by hand, typeset a message with the built-in 5×7 pixel font, drop in an image, or sample somebody's real activity and remix it.",
  },
  {
    n: "02",
    title: "Connect GitHub",
    icon: IconGitHub,
    iconSize: 17,
    body: "Real OAuth: hit Authorize, approve on github.com, and the app exchanges the one-time code server-side for a user token. Client ID and Secret come from env vars or the studio's setup card. Tokens are AES-256-GCM encrypted at rest so the painter can keep running while you're away.",
  },
  {
    n: "03",
    title: "Arm the interval",
    icon: IconClock,
    body: "Choose a cadence — every 30 seconds or every 6 hours — and how many pixels each tick lays down. The server-side scheduler wakes up, paints its batch, writes to the run log, and sleeps until the next tick.",
  },
  {
    n: "04",
    title: "Watch it develop",
    icon: IconLayers,
    body: "Each pixel becomes one or more real commits with an author date backdated onto that grid day. Follow the run log live, then diff your design against the calendar GitHub actually reports.",
  },
];

const RAMP = [
  { level: 0, label: "empty", commits: "0 commits", note: "day left untouched" },
  { level: 1, label: "first quartile", commits: "1 commit", note: "faintest shade" },
  { level: 2, label: "second quartile", commits: "2 commits", note: "" },
  { level: 3, label: "third quartile", commits: "3 commits", note: "" },
  { level: 4, label: "fourth quartile", commits: "4+ commits", note: "darkest shade" },
];

const API_SEQUENCE = [
  "GET  /repos/{owner}/{repo}/git/ref/heads/main      → head sha",
  "POST /repos/{owner}/{repo}/git/blobs               → pixel manifest",
  "POST /repos/{owner}/{repo}/git/trees               → base_tree = head",
  "POST /repos/{owner}/{repo}/git/commits             → author.date = 2025-03-11T12:07:00Z",
  "…repeat for every commit in this tick's batch…",
  "PATCH /repos/{owner}/{repo}/git/refs/heads/main    → one ref move, whole batch lands",
];

const FAQ = [
  {
    q: "Do the commits actually exist?",
    a: "Yes. Every pixel is a real commit object in a repository you own, created through the Git Data API with a backdated author date. Nothing is spoofed at the graph level — GitHub counts them because they are genuine commits attributed to your verified email.",
  },
  {
    q: "Why do I need a dedicated repo?",
    a: "Commits only reach the graph from a standalone (non-fork) repository's default branch. The painter creates something like <you>-pixels and keeps the noise out of your real projects. Delete the repo and the pixels disappear with it.",
  },
  {
    q: "What about the rate limit?",
    a: "Each commit costs two API calls, so a 4-intensity pixel costs eight. At the default 6 cells per tick with a 15 minute interval you stay far below the 5,000 requests/hour budget — the studio shows your remaining quota before you arm a job.",
  },
  {
    q: "Can I try it without connecting anything?",
    a: "Yes — simulate mode runs the identical scheduler, ordering and logging, but writes to a virtual canvas instead of GitHub. The demo on this page is a simulate-mode job looping forever. The full explanation lives in the guide.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[1180px] px-5 pb-24 sm:px-8">
      <nav className="sticky top-0 z-40 -mx-5 mb-10 border-b border-ink-700/70 bg-ink-950/80 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Wordmark />
          </Link>
          <div className="hidden items-center gap-6 font-mono text-[11px] uppercase tracking-[0.16em] text-mist-400 md:flex">
            <a href="#how" className="transition-colors hover:text-mist-100">how it works</a>
            <a href="#ramp" className="transition-colors hover:text-mist-100">intensities</a>
            <a href="#presets" className="transition-colors hover:text-mist-100">presets</a>
            <a href="#faq" className="transition-colors hover:text-mist-100">faq</a>
            <Link href="/guide" className="text-acid-400 transition-colors hover:text-acid-300">how it works</Link>
          </div>
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

      {/* hero */}
      <header className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-jade-500/40 bg-jade-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-jade-300">
            <span className="h-1.5 w-1.5 animate-blink rounded-full bg-jade-300" />
            scheduler running · demo job live
          </div>
          <h1 className="mt-5 text-[clamp(2.4rem,6.4vw,4.4rem)] font-bold leading-[0.95] tracking-[-0.03em] text-mist-100">
            Your contribution
            <br />
            graph is a
            <span className="relative ml-3 inline-block">
              <span className="relative z-10 text-ink-950">canvas.</span>
              <span className="absolute inset-0 -skew-x-6 bg-acid-400" aria-hidden />
            </span>
          </h1>
          <p className="mt-6 max-w-[54ch] text-[15px] leading-relaxed text-mist-300">
            Design a bitmap, connect your GitHub account, and arm an interval painter that walks the
            grid tick by tick — turning each pixel into backdated commits until the whole year
            develops into your picture.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 rounded-md bg-acid-400 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-950 transition-all hover:bg-acid-300 hover:shadow-[0_0_36px_-10px_rgba(200,247,81,0.9)]"
            >
              <IconBrush width={15} height={15} /> start painting
            </Link>
            <Link
              href="/guide"
              className="inline-flex items-center gap-2 rounded-md border border-ink-500 bg-ink-850 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-mist-200 transition-colors hover:border-jade-300/60 hover:text-mist-100"
            >
              <IconTerminal width={15} height={15} /> how it works
            </Link>
          </div>
          <dl className="mt-9 grid max-w-lg grid-cols-3 gap-4 border-t border-ink-700 pt-5">
            {[
              ["371", "pixels per year"],
              ["5", "intensity levels"],
              ["4s", "scheduler sweep"],
            ].map(([v, k]) => (
              <div key={k}>
                <dt className="font-mono text-2xl leading-none text-acid-400 tabular-nums">{v}</dt>
                <dd className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-mist-400">
                  {k}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="animate-floaty">
          <LiveCanvas />
        </div>
      </header>

      {/* how it works */}
      <section id="how" className="mt-28 grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-acid-400">
            the loop
          </div>
          <h2 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-mist-100">
            Four steps from blank grid to developed bitmap
          </h2>
          <p className="mt-4 text-[13.5px] leading-relaxed text-mist-400">
            The painter is a boring, reliable loop: pick the next unpainted pixels, forge commits
            with the right author dates, move one ref, log it, sleep.
          </p>
        </div>
        <ol className="space-y-4">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="group relative flex gap-5 rounded-lg border border-ink-700 bg-ink-900/60 p-5 transition-colors hover:border-jade-500/50"
            >
              <div className="flex flex-col items-center gap-2">
                <span className="font-mono text-[11px] tracking-widest text-mist-400">{s.n}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-ink-600 bg-ink-850 text-jade-300 transition-colors group-hover:border-acid-400/50 group-hover:text-acid-300">
                  <s.icon width={s.iconSize ?? 18} height={s.iconSize ?? 18} />
                </span>
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-mist-100">{s.title}</h3>
                <p className="mt-2 max-w-[70ch] text-[13.5px] leading-relaxed text-mist-300">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ramp */}
      <section id="ramp" className="mt-24 rounded-xl border border-ink-700 bg-ink-900/60 p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-acid-400">
              intensity model
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-mist-100">
              One shade is a commit count
            </h2>
          </div>
          <p className="max-w-[46ch] text-[13px] leading-relaxed text-mist-400">
            GitHub buckets each day into quartiles of your busiest day. The painter writes exactly
            enough commits to land in the bucket you drew — and lets you multiply them if your year
            is already busy.
          </p>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-5">
          {RAMP.map((r) => (
            <div key={r.level} className="rounded-lg border border-ink-700 bg-ink-850/60 p-3">
              <div className={`cell-${r.level} h-10 w-full rounded-md border border-ink-600/60`} />
              <div className="mt-3 flex items-baseline justify-between">
                <span className="font-mono text-lg text-mist-100 tabular-nums">{r.level}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-acid-300">
                  {r.commits}
                </span>
              </div>
              <div className="mt-1 text-[11.5px] text-mist-400">{r.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* under the hood */}
      <section className="mt-24 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-ink-700 bg-ink-950/70 p-6">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-mist-400">
            <IconTerminal width={14} height={14} className="text-jade-300" /> one tick, on the wire
          </div>
          <pre className="mt-4 overflow-x-auto font-mono text-[11.5px] leading-[1.9] text-mist-200">
            {API_SEQUENCE.map((line) => (
              <div key={line} className={line.startsWith("…") ? "text-mist-400" : undefined}>
                <span className="mr-3 text-ink-500">$</span>
                {line}
              </div>
            ))}
          </pre>
          <p className="mt-4 border-t border-ink-700 pt-4 text-[12.5px] leading-relaxed text-mist-400">
            No <span className="font-mono text-mist-200">git</span> binary, no cloning, no working
            tree. The whole batch is assembled as git objects and published with a single ref
            update, so a tick is atomic from the graph's point of view.
          </p>
        </div>
        <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-6">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-mist-400">
            <IconGrid width={14} height={14} className="text-jade-300" /> what you can draw with
          </div>
          <ul className="mt-4 space-y-3 text-[13.5px] text-mist-200">
            {[
              "Hand-painted pixels with a five-step brush, drag-fill and shift-to-erase",
              "A 5×7 bitmap font — typeset up to eight characters anywhere in the year",
              "Twelve built-in presets: punisher skulls, invader fleets, skylines, ECG traces",
              "Image import — any PNG is downsampled and quantised onto the 53×7 grid",
              "Live sampling of a real GitHub calendar, yours or anyone's public profile",
              "Transform tools: mirror, invert, shift columns, densify, clear",
            ].map((line) => (
              <li key={line} className="flex gap-3">
                <IconCheck width={16} height={16} className="mt-0.5 shrink-0 text-acid-400" />
                <span className="leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center gap-2 rounded-md border border-ink-600 bg-ink-850 px-3 py-2.5 font-mono text-[11px] text-mist-300">
            <IconBolt width={14} height={14} className="text-acid-400" />
            cadence is yours: 30s sprints or a 6-hour drip over a fortnight
          </div>
        </div>
      </section>

      {/* presets */}
      <section id="presets" className="mt-24">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-acid-400">
              pattern library
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-mist-100">
              Hover a preset, load it in the studio
            </h2>
          </div>
          <Link
            href="/studio"
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-jade-300 transition-colors hover:text-acid-300"
          >
            blank canvas →
          </Link>
        </div>
        <PresetGallery />
      </section>

      {/* faq */}
      <section id="faq" className="mt-24 grid gap-6 lg:grid-cols-2">
        {FAQ.map((f) => (
          <div key={f.q} className="rounded-lg border border-ink-700 bg-ink-900/50 p-5">
            <h3 className="font-mono text-[12px] uppercase tracking-[0.14em] text-acid-300">{f.q}</h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-mist-300">{f.a}</p>
          </div>
        ))}
      </section>

      <footer className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-ink-700 pt-8">
        <div>
          <p className="font-mono text-[11px] text-mist-400">
            pixelpunisher.x — backdated commits as pixels. Paint responsibly: use a dedicated repo.
          </p>
          <p className="mt-1.5 font-mono text-[10.5px] text-mist-400/70">
            © {new Date().getFullYear()} pixelpunisher.x · designed with{" "}
            <span className="text-rust-400">❤</span> by unlike.u
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/guide"
            className="inline-flex items-center gap-2 rounded-md border border-ink-500 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-mist-200 transition-colors hover:border-acid-400/60 hover:text-acid-300"
          >
            <IconTerminal width={14} height={14} /> read the guide
          </Link>
          <Link
            href="/studio"
            className="inline-flex items-center gap-2 rounded-md bg-acid-400 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-950 transition-colors hover:bg-acid-300"
          >
            <IconGitHub width={14} height={14} /> connect &amp; paint
          </Link>
        </div>
      </footer>
    </main>
  );
}
