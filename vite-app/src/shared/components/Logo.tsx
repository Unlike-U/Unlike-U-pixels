/**
 * The pixelpunisher.x mark — a pixelated skull.
 *
 * Legend:
 *   '@' outline   '#' bone   '+' shaded bone   'x' socket / cavity   'o' acid eye glow
 *
 * Every tone is driven by a CSS variable (see globals.css → --logo-*), so the
 * mark re-inks itself for the light and dark themes and stays pixel-crisp at
 * any size thanks to shape-rendering="crispEdges".
 */

/** Full 16×16 mark — cracked cranium, hollow sockets, glowing eyes, gapped teeth. */
export const SKULL_FULL = [
  ".....@@@@@@.....",
  "...@@######@@...",
  "..@#######@##@..",
  ".@#######@####@.",
  "@########@#####@",
  "@##############@",
  "@#xxxx####xxxx#@",
  "@#xoox####xoox#@",
  "@+xxxx#xx#xxxx+@",
  ".@+###xxxx###+@.",
  ".@++########++@.",
  "..@@########@@..",
  "...@#x#xx#x#@...",
  "...@+x#xx#x+@...",
  "....@######@....",
  ".....@@@@@@.....",
];

/** 10×10 icon cut — tuned for the wordmark, favicon and tiny sizes. */
export const SKULL_ICON = [
  "..@@@@@@..",
  ".@######@.",
  "@########@",
  "@#xx##xx#@",
  "@#ox##xo#@",
  "@###@@###@",
  ".@+####+@.",
  ".@#x##x#@.",
  "..@####@..",
  "...@@@@...",
];

/** 7×7 glyph — the version that fits a contribution grid (see grid.ts). */
export const SKULL_MINI = [
  ".#####.",
  "#######",
  "#.###.#",
  "###.###",
  ".#####.",
  ".#.#.#.",
  "..###..",
];

const TONE: Record<string, string> = {
  "@": "var(--logo-ink)",
  "#": "var(--logo-bone)",
  "+": "var(--logo-shade)",
  x: "var(--logo-socket)",
  o: "var(--logo-eye)",
};

function SkullSvg({
  map,
  size,
  className,
  title,
  glow = true,
}: {
  map: string[];
  size: number;
  className?: string;
  title?: string;
  glow?: boolean;
}) {
  const w = map[0]?.length ?? 0;
  const h = map.length;
  const rects: React.ReactNode[] = [];
  const eyes: React.ReactNode[] = [];

  map.forEach((row, y) => {
    row.split("").forEach((ch, x) => {
      const fill = TONE[ch];
      if (!fill) return;
      const rect = <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />;
      if (ch === "o") eyes.push(rect);
      else rects.push(rect);
    });
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      role="img"
      aria-label={title ?? "pixelpunisher.x logo"}
      shapeRendering="crispEdges"
    >
      {title && <title>{title}</title>}
      {rects}
      {glow && (
        <g opacity={0.55} style={{ filter: "blur(0.6px)" }} aria-hidden>
          {eyes}
        </g>
      )}
      {eyes}
    </svg>
  );
}

/** Full detailed logo mark (hero, docs, large placements). */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return <SkullSvg map={SKULL_FULL} size={size} className={className} />;
}

/** Simplified icon mark — wordmark, badges, footers. */
export function LogoMini({ size = 18, className }: { size?: number; className?: string }) {
  return <SkullSvg map={SKULL_ICON} size={size} className={className} glow={size >= 18} />;
}

/** Wordmark lockup used in headers. */
export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span className="group inline-flex items-center gap-2.5">
      <span
        className="relative inline-flex items-center justify-center rounded-[7px] border border-ink-600 bg-ink-850 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors group-hover:border-acid-400/60"
        style={{ width: size, height: size }}
      >
        <LogoMini size={size - 10} />
      </span>
      <span className="font-mono text-[12.5px] font-bold uppercase leading-none tracking-[0.16em] text-mist-100">
        pixel<span className="text-acid-400">punisher</span>
        <span className="text-mist-400">.x</span>
      </span>
    </span>
  );
}
