/**
 * grid.ts — the bitmap engine.
 *
 * A pattern is a flat Int array laid out column-major:
 *   index = column * ROWS + row     (column = ISO week, row = day of week)
 * Values 0..4 map to the five contribution intensities.
 */

export const ROWS = 7;
export const COLS = 53;

export type Cells = number[];

export const idx = (col: number, row: number) => col * ROWS + row;
export const colOf = (i: number) => Math.floor(i / ROWS);
export const rowOf = (i: number) => i % ROWS;

export function emptyCells(cols = COLS, rows = ROWS): Cells {
  return new Array(cols * rows).fill(0);
}

export function clampLevel(v: number) {
  return Math.max(0, Math.min(4, Math.round(v)));
}

export function cloneCells(cells: Cells): Cells {
  return cells.slice();
}

export function setCell(cells: Cells, i: number, v: number): Cells {
  const next = cloneCells(cells);
  if (i >= 0 && i < next.length) next[i] = clampLevel(v);
  return next;
}

export function fillRect(
  cells: Cells,
  col: number,
  row: number,
  w: number,
  h: number,
  v: number,
): Cells {
  const next = cloneCells(cells);
  for (let c = col; c < col + w; c++) {
    for (let r = row; r < row + h; r++) {
      const i = idx(c, r);
      if (i >= 0 && i < next.length) next[i] = clampLevel(v);
    }
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* 5x7 pixel font                                                      */
/* ------------------------------------------------------------------ */

const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#..##", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["#..#.", "#..#.", "#..#.", "#####", "...#.", "...#.", "...#."],
  "5": ["#####", "#....", "#....", "####.", "....#", "....#", "####."],
  "6": [".###.", "#...#", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "#...#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "*": [".....", "#.#.#", ".###.", "#####", ".###.", "#.#.#", "....."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
  ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
  "%": ["#...#", "#..#.", "...#.", "..#..", ".#...", ".#..#", "#...#"],
  "♥": [".....", ".#.#.", "#####", "#####", "#####", ".###.", "..#.."],
};

export const FONT_WIDTH = 5;
export const FONT_HEIGHT = 7;
export const GLYPH_ADVANCE = 6; // 5 wide + 1 gutter

/** Render text into a bitmap, horizontally centred inside `cols` weeks. */
export function textToCells(
  text: string,
  opts: { cols?: number; level?: number; startCol?: number } = {},
): Cells {
  const cols = opts.cols ?? COLS;
  const level = opts.level ?? 4;
  const cells = emptyCells(cols);
  const chars = text.toUpperCase().split("");
  const width = Math.max(0, chars.length * GLYPH_ADVANCE - 1);
  let col = opts.startCol ?? Math.max(0, Math.floor((cols - width) / 2));

  for (const ch of chars) {
    const glyph = FONT[ch] ?? FONT[ch.toUpperCase()] ?? FONT["?"];
    for (let r = 0; r < FONT_HEIGHT; r++) {
      for (let x = 0; x < FONT_WIDTH; x++) {
        if (glyph[r][x] === "#") {
          const i = idx(col + x, r);
          if (i >= 0 && i < cells.length) cells[i] = level;
        }
      }
    }
    col += GLYPH_ADVANCE;
  }
  return cells;
}

export function maxTextLength(cols = COLS) {
  return Math.floor((cols + 1) / GLYPH_ADVANCE);
}

/* ------------------------------------------------------------------ */
/* sprites                                                             */
/* ------------------------------------------------------------------ */

type Sprite = string[];

function stampSprite(cells: Cells, sprite: Sprite, col: number, level = 4) {
  for (let r = 0; r < sprite.length; r++) {
    for (let x = 0; x < sprite[r].length; x++) {
      const ch = sprite[r][x];
      if (ch === "." || ch === " ") continue;
      const v = ch === "#" ? level : clampLevel(Number(ch));
      const i = idx(col + x, r);
      if (i >= 0 && i < cells.length) cells[i] = v;
    }
  }
}

const INVADER: Sprite = [
  "..#.....#..",
  "...#...#...",
  "..#######..",
  ".##.###.##.",
  "###########",
  "#.#######.#",
  "#.#.....#.#",
];

const HEART: Sprite = [
  ".##.##.",
  "#######",
  "#######",
  "#######",
  ".#####.",
  "..###..",
  "...#...",
];

const GHOST: Sprite = [
  "..#####..",
  ".########.",
  "##.####.##",
  "##########",
  "##########",
  "##########",
  "#.##.##.#.",
];

const SHIP: Sprite = [
  "....#....",
  "...###...",
  "...###...",
  ".#######.",
  "#########",
  "#########",
  "#.##.##.#",
];

const MUSHROOM: Sprite = [
  "..#####..",
  ".###.###.",
  "#########",
  "#########",
  "..#####..",
  "..#.##.#.",
  "..#####..",
];

const WAVE: Sprite = ["....#....", "...##....", "..##.....", ".##......", "##.......", "#........", "........."];

/** Simplified pixelpunisher.x skull — 7×7, designed to fit a contribution grid. */
export const SKULL_MINI_SPRITE: Sprite = [
  ".#####.",
  "#######",
  "#.###.#",
  "###.###",
  ".#####.",
  ".#.#.#.",
  "..###..",
];

export const SPRITES: Record<string, Sprite> = {
  invader: INVADER,
  heart: HEART,
  ghost: GHOST,
  ship: SHIP,
  mushroom: MUSHROOM,
  wave: WAVE,
  skull: SKULL_MINI_SPRITE,
};

/* ------------------------------------------------------------------ */
/* presets                                                             */
/* ------------------------------------------------------------------ */

export type Preset = {
  id: string;
  name: string;
  blurb: string;
  build: () => Cells;
};

function tiledSprite(sprite: Sprite, gap: number, level = 4) {
  const cells = emptyCells();
  const step = sprite[0].length + gap;
  for (let col = 1; col < COLS; col += step) stampSprite(cells, sprite, col, level);
  return cells;
}

export const PRESETS: Preset[] = [
  {
    id: "punisher",
    name: "Punisher skulls",
    blurb: "The pixelpunisher.x mark — simplified 7×7 skulls tiled across the year.",
    build: () => tiledSprite(SKULL_MINI_SPRITE, 2),
  },
  {
    id: "invaders",
    name: "Invader fleet",
    blurb: "Classic 11px sprites marching across the year.",
    build: () => tiledSprite(INVADER, 4),
  },
  {
    id: "hearts",
    name: "Heartbeat",
    blurb: "A row of hearts, ramping intensity left to right.",
    build: () => {
      const cells = emptyCells();
      for (let n = 0; n < 9; n++) {
        const col = 1 + n * 6;
        const level = clampLevel(1 + Math.floor((n / 8) * 3.4));
        stampSprite(cells, HEART, col, level);
      }
      return cells;
    },
  },
  {
    id: "skyline",
    name: "Night skyline",
    blurb: "Procedural city blocks with lit windows.",
    build: () => {
      const cells = emptyCells();
      let seed = 1337;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
      let col = 0;
      while (col < COLS) {
        const w = 2 + Math.floor(rnd() * 3);
        const h = 2 + Math.floor(rnd() * 5);
        for (let c = col; c < Math.min(COLS, col + w); c++) {
          for (let r = ROWS - h; r < ROWS; r++) {
            const i = idx(c, r);
            if (i < cells.length) cells[i] = rnd() > 0.62 ? 4 : rnd() > 0.4 ? 2 : 1;
          }
        }
        col += w + 1;
      }
      return cells;
    },
  },
  {
    id: "sine",
    name: "Sine sweep",
    blurb: "A travelling waveform sampled across 53 weeks.",
    build: () => {
      const cells = emptyCells();
      for (let c = 0; c < COLS; c++) {
        const y = 3 + Math.round(2.4 * Math.sin(c / 3.1));
        for (let r = 0; r < ROWS; r++) {
          const d = Math.abs(r - y);
          const i = idx(c, r);
          cells[i] = d === 0 ? 4 : d === 1 ? 2 : d === 2 ? 1 : 0;
        }
      }
      return cells;
    },
  },
  {
    id: "gradient",
    name: "Ramp fade",
    blurb: "Full five-step intensity ramp — useful for calibration.",
    build: () => {
      const cells = emptyCells();
      for (let c = 0; c < COLS; c++) {
        const level = clampLevel(Math.floor((c / COLS) * 5));
        for (let r = 0; r < ROWS; r++) cells[idx(c, r)] = level;
      }
      return cells;
    },
  },
  {
    id: "checker",
    name: "Checkerboard",
    blurb: "Alternating parity pixels.",
    build: () => {
      const cells = emptyCells();
      for (let c = 0; c < COLS; c++)
        for (let r = 0; r < ROWS; r++)
          cells[idx(c, r)] = (c + r) % 2 === 0 ? 4 : 0;
      return cells;
    },
  },
  {
    id: "diagonal",
    name: "Bias tape",
    blurb: "Diagonal stripes on a two-step ramp.",
    build: () => {
      const cells = emptyCells();
      for (let c = 0; c < COLS; c++)
        for (let r = 0; r < ROWS; r++) {
          const m = (c + r) % 6;
          cells[idx(c, r)] = m === 0 ? 4 : m === 1 ? 2 : 0;
        }
      return cells;
    },
  },
  {
    id: "matrix",
    name: "Rain fall",
    blurb: "Randomised descending trails.",
    build: () => {
      const cells = emptyCells();
      let seed = 90210;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
      for (let c = 0; c < COLS; c++) {
        if (rnd() < 0.55) continue;
        const start = Math.floor(rnd() * 4);
        const len = 2 + Math.floor(rnd() * 4);
        for (let k = 0; k < len; k++) {
          const r = start + k;
          if (r >= ROWS) break;
          cells[idx(c, r)] = clampLevel(4 - k);
        }
      }
      return cells;
    },
  },
  {
    id: "bars",
    name: "Bar chart",
    blurb: "Pseudo-random histogram growing from the baseline.",
    build: () => {
      const cells = emptyCells();
      let seed = 4242;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
      for (let c = 0; c < COLS; c++) {
        const h = Math.floor(rnd() * 7);
        for (let r = ROWS - 1; r >= ROWS - h; r--) {
          const t = (ROWS - r) / 7;
          cells[idx(c, r)] = clampLevel(1 + Math.round(t * 3));
        }
      }
      return cells;
    },
  },
  {
    id: "ghosts",
    name: "Ghost chase",
    blurb: "Four ghosts, one pellet trail.",
    build: () => {
      const cells = emptyCells();
      for (let n = 0; n < 4; n++) stampSprite(cells, GHOST, 2 + n * 13, n === 3 ? 4 : 2);
      for (let c = 0; c < COLS; c++) if (c % 3 === 0) cells[idx(c, 6)] = 1;
      return cells;
    },
  },
  {
    id: "lifeline",
    name: "Flatline",
    blurb: "An ECG trace across the year.",
    build: () => {
      const cells = emptyCells();
      const trace = [3, 3, 3, 2, 4, 3, 3, 3, 3, 1, 3, 4, 2, 3, 3];
      for (let c = 0; c < COLS; c++) {
        const row = trace[c % trace.length];
        cells[idx(c, row)] = row === 3 ? 2 : 4;
      }
      return cells;
    },
  },
];

export const HELLO_CELLS = () => textToCells("HELLO");

/* ------------------------------------------------------------------ */
/* date math                                                           */
/* ------------------------------------------------------------------ */

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Sunday that starts the week `weeksBack` weeks before the current week. */
export function anchorForWeeksBack(weeksBack = COLS - 1, from = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const dow = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - dow - weeksBack * 7);
  return isoDate(d);
}

export function dateForCell(anchor: string, i: number, hourUtc = 12): Date {
  const [y, m, d] = anchor.split("-").map(Number);
  const base = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hourUtc, 0, 0);
  return new Date(base + colOf(i) * 7 * 86400000 + rowOf(i) * 86400000);
}

/** Commits needed for a target intensity. Level 0 means "leave the day empty". */
export function commitsForLevel(level: number, multiplier = 1) {
  if (level <= 0) return 0;
  return Math.max(1, clampLevel(level) * Math.max(1, multiplier));
}

export type PaintOrder = "column" | "row" | "intensity" | "random" | "spiral";

/** Which order the painter walks the bitmap in. */
export function paintOrder(cells: Cells, order: PaintOrder, seed = 7): number[] {
  const targets: number[] = [];
  for (let i = 0; i < cells.length; i++) if (cells[i] > 0) targets.push(i);

  switch (order) {
    case "row":
      targets.sort((a, b) => rowOf(a) - rowOf(b) || colOf(a) - colOf(b));
      break;
    case "intensity":
      targets.sort((a, b) => cells[b] - cells[a] || colOf(a) - colOf(b));
      break;
    case "random": {
      let s = seed;
      const rnd = () => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
      };
      for (let i = targets.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [targets[i], targets[j]] = [targets[j], targets[i]];
      }
      break;
    }
    case "spiral": {
      const cx = COLS / 2;
      const cy = ROWS / 2;
      targets.sort((a, b) => {
        const da = Math.hypot(colOf(a) - cx, (rowOf(a) - cy) * 4);
        const db = Math.hypot(colOf(b) - cx, (rowOf(b) - cy) * 4);
        return da - db;
      });
      break;
    }
    default:
      targets.sort((a, b) => a - b);
  }
  return targets;
}

export function summarize(cells: Cells) {
  const levels = [0, 0, 0, 0, 0];
  let lit = 0;
  for (const v of cells) {
    levels[clampLevel(v)]++;
    if (v > 0) lit++;
  }
  return { lit, total: cells.length, levels, coverage: lit / Math.max(1, cells.length) };
}

/** Turn any HxW matrix of 0..4 values into a 53x7 bitmap (crop + centre). */
export function matrixToCells(matrix: number[][], cols = COLS): Cells {
  const cells = emptyCells(cols);
  const srcH = matrix.length;
  const srcW = matrix[0]?.length ?? 0;
  if (!srcH || !srcW) return cells;
  const scale = Math.min(cols / srcW, ROWS / srcH);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const offCol = Math.floor((cols - w) / 2);
  const offRow = Math.floor((ROWS - h) / 2);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const sy = Math.min(srcH - 1, Math.floor((r / h) * srcH));
      const sx = Math.min(srcW - 1, Math.floor((c / w) * srcW));
      const i = idx(offCol + c, offRow + r);
      if (i >= 0 && i < cells.length) cells[i] = clampLevel(matrix[sy][sx]);
    }
  }
  return cells;
}

export function shiftColumns(cells: Cells, by: number): Cells {
  const cols = cells.length / ROWS;
  const next = emptyCells(cols);
  for (let i = 0; i < cells.length; i++) {
    const c = (colOf(i) + by + cols) % cols;
    next[idx(c, rowOf(i))] = cells[i];
  }
  return next;
}

export function mirrorCells(cells: Cells, axis: "h" | "v"): Cells {
  const cols = cells.length / ROWS;
  const next = emptyCells(cols);
  for (let i = 0; i < cells.length; i++) {
    const c = axis === "v" ? cols - 1 - colOf(i) : colOf(i);
    const r = axis === "h" ? ROWS - 1 - rowOf(i) : rowOf(i);
    next[idx(c, r)] = cells[i];
  }
  return next;
}
