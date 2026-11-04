import { useEffect, useMemo, useState } from "react";
import PixelGrid from "@shared/components/PixelGrid";
import { Logo, LogoMini, Wordmark } from "@shared/components/Logo";
import ThemeToggle from "@shared/components/ThemeToggle";
import { PRESETS, summarize } from "@shared/lib/grid";
import Guide from "./Guide";
import Studio from "./Studio";

/* ---------------- tiny hash router ---------------- */

function useRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#\/?/, ""));
  useEffect(() => {
    const on = () => setRoute(window.location.hash.replace(/^#\/?/, ""));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route || "home";
}

function Nav({ route }: { route: string }) {
  const links: [string, string][] = [
    ["home", "home"],
    ["studio", "studio"],
    ["guide", "how it works"],
  ];
  return (
    <nav className="sticky top-0 z-40 -mx-5 mb-10 border-b border-ink-700/70 bg-ink-950/85 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <a href="#/">
          <Wordmark />
        </a>
        <div className="hidden items-center gap-6 font-mono text-[11px] uppercase tracking-[0.16em] text-mist-400 md:flex">
          {links.map(([id, label]) => (
            <a
              key={id}
              href={`#/${id === "home" ? "" : id}`}
              className={route === id ? "text-acid-400" : "transition-colors hover:text-mist-100"}
            >
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <a
            href="#/studio"
            className="rounded-md bg-acid-400 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-950 transition-colors hover:bg-acid-300"
          >
            open studio
          </a>
        </div>
      </div>
    </nav>
  );
}

function Credits() {
  return (
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
      <a
        href="#/studio"
        className="inline-flex items-center gap-2 rounded-md bg-acid-400 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-950 transition-colors hover:bg-acid-300"
      >
        connect &amp; paint
      </a>
    </footer>
  );
}

/* ---------------- live simulated demo (runs entirely in the browser) ---------------- */

function LiveDemo() {
  const [tick, setTick] = useState(0);
  const [presetIdx, setPresetIdx] = useState(0);
  const built = useMemo(() => PRESETS.map((p) => ({ ...p, cells: p.build() })), []);
  const current = built[presetIdx % built.length];
  const lit = useMemo(
    () => current.cells.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0),
    [current],
  );

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1100);
    return () => clearInterval(t);
  }, []);

  const paintedCount = Math.min(lit.length, tick * 4);
  const painted = lit.slice(0, paintedCount);

  useEffect(() => {
    if (paintedCount >= lit.length && lit.length > 0) {
      const t = setTimeout(() => {
        setPresetIdx((i) => i + 1);
        setTick(0);
      }, 2600);
      return () => clearTimeout(t);
    }
  }, [paintedCount, lit.length]);

  const stats = summarize(current.cells);

  return (
    <div className="relative overflow-hidden rounded-xl border border-ink-600 bg-ink-900/85 p-4 shadow-[0_40px_120px_-60px_rgba(200,247,81,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <LogoMini size={22} />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-mist-400">
              live painter · browser simulate mode
            </div>
            <div className="text-[13px] text-mist-100">{current.name}</div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-acid-400/50 bg-acid-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-acid-300">
          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-current" />
          running
        </span>
      </div>
      <div className="mt-4">
        <PixelGrid cells={current.cells} painted={painted} compact />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          ["pixels lit", stats.lit],
          ["painted", `${painted.length}/${stats.lit}`],
          ["commits", painted.reduce((s, i) => s + (current.cells[i] ?? 0), 0)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-ink-700 bg-ink-850/70 px-2.5 py-2">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-mist-400">{k}</div>
            <div className="mt-0.5 font-mono text-base tabular-nums text-acid-300">{v}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-mist-400">
        This demo paints with an in-browser interval engine. In the studio, the same engine commits
        to your real GitHub graph — or the Next.js edition paints server-side while you sleep.
      </p>
    </div>
  );
}

/* ---------------- landing ---------------- */

const STEPS = [
  {
    n: "01",
    t: "Draw the bitmap",
    b: "A contribution graph is a 53 × 7 grid — 371 pixels with five intensities. Paint by hand, typeset with the 5×7 pixel font, import an image, or sample a real calendar.",
  },
  {
    n: "02",
    t: "Connect GitHub",
    b: "OAuth authorization-code flow (via the bundled Vercel Function), device flow, or a personal access token. The painter resolves your verified email so commits actually count.",
  },
  {
    n: "03",
    t: "Arm the interval",
    b: "Pick a cadence and a batch size. The engine wakes up, paints its batch of pixels as backdated commits, logs it, and sleeps until the next tick.",
  },
  {
    n: "04",
    t: "Watch it develop",
    b: "Each pixel becomes real commits dated on that grid day. Diff your design against the calendar GitHub reports until the match reads 100%.",
  },
];

function Landing() {
  const built = useMemo(() => PRESETS.map((p) => ({ ...p, cells: p.build() })), []);
  const [active, setActive] = useState(0);
  const current = built[active];

  return (
    <>
      <header className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-jade-500/40 bg-jade-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-jade-300">
            <LogoMini size={13} /> pixelpunisher.x · vite edition
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
            <a
              href="#/studio"
              className="inline-flex items-center gap-2 rounded-md bg-acid-400 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-950 transition-all hover:bg-acid-300"
            >
              start painting
            </a>
            <a
              href="#/guide"
              className="inline-flex items-center gap-2 rounded-md border border-ink-500 bg-ink-850 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-mist-200 transition-colors hover:border-jade-300/60 hover:text-mist-100"
            >
              how it works
            </a>
          </div>
          <dl className="mt-9 grid max-w-lg grid-cols-3 gap-4 border-t border-ink-700 pt-5">
            {[
              ["371", "pixels per year"],
              ["5", "intensity levels"],
              ["2", "ways to run it"],
            ].map(([v, k]) => (
              <div key={k}>
                <dt className="font-mono text-2xl leading-none text-acid-400 tabular-nums">{v}</dt>
                <dd className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-mist-400">
                  {k}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-900/60 p-4">
            <Logo size={44} />
            <p className="text-[12.5px] leading-relaxed text-mist-400">
              The mark is a 16×16 pixel skull; the simplified 7×7 version ships in the studio
              pattern library and tiles across a real contribution graph.
            </p>
          </div>
        </div>
        <LiveDemo />
      </header>

      <section className="mt-24">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-acid-400">the loop</div>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-mist-100">
          Four steps from blank grid to developed bitmap
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-lg border border-ink-700 bg-ink-900/60 p-5">
              <div className="font-mono text-[11px] tracking-widest text-mist-400">{s.n}</div>
              <h3 className="mt-1 text-[17px] font-semibold text-mist-100">{s.t}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-mist-300">{s.b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-acid-400">
              pattern library
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-mist-100">
              Hover a preset, load it in the studio
            </h2>
          </div>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {built.map((p, i) => (
              <button
                key={p.id}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                className={`group rounded-lg border bg-ink-900/70 p-3 text-left transition-all ${
                  i === active
                    ? "border-acid-400/60 bg-ink-850"
                    : "border-ink-700 hover:border-jade-300/40"
                }`}
              >
                <PixelGrid cells={p.cells} compact />
                <div className="mt-2.5 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-mist-200">
                    {p.name}
                  </span>
                  <span className="font-mono text-[9.5px] text-mist-400">{p.id}</span>
                </div>
              </button>
            ))}
          </div>
          <aside className="rounded-lg border border-ink-700 bg-ink-900/70 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-mist-400">selected</div>
            <h3 className="mt-1 text-xl text-mist-100">{current.name}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-mist-300">{current.blurb}</p>
            <div className="mt-4">
              <PixelGrid cells={current.cells} compact />
            </div>
            <a
              href={`#/studio?preset=${current.id}`}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-acid-400 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-950 transition-colors hover:bg-acid-300"
            >
              load in studio →
            </a>
          </aside>
        </div>
      </section>

      <Credits />
    </>
  );
}

/* ---------------- shell ---------------- */

export default function App() {
  const route = useRoute();
  const page = route.startsWith("studio") ? "studio" : route.startsWith("guide") ? "guide" : "home";

  return (
    <main className="mx-auto w-full max-w-[1180px] px-5 pb-24 sm:px-8">
      <Nav route={page} />
      {page === "studio" ? <Studio /> : page === "guide" ? <Guide /> : <Landing />}
      {page !== "home" && <Credits />}
    </main>
  );
}
