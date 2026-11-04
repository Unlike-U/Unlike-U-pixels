import { COLS, ROWS, clampLevel, emptyCells, idx } from "./grid";
import type { Cells } from "./grid";

/** Quantise an uploaded image onto the 53×7 contribution grid. */
export async function fileToCells(file: File, cols = COLS): Promise<Cells> {
  const bitmap = await loadBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = ROWS;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bitmap, 0, 0, cols, ROWS);
  const data = ctx.getImageData(0, 0, cols, ROWS).data;

  const values: number[] = [];
  for (let i = 0; i < cols * ROWS; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];
    // luminance, with alpha fading towards "empty"
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) * (a / 255);
    values.push(lum);
  }
  const max = Math.max(...values, 1);
  const cells = emptyCells(cols);
  values.forEach((v, i) => {
    const t = v / max;
    cells[i] = t < 0.12 ? 0 : t < 0.35 ? 1 : t < 0.58 ? 2 : t < 0.8 ? 3 : 4;
  });
  return cells;
}

function loadBitmap(file: File): Promise<CanvasImageSource> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    };
    img.onerror = () => reject(new Error("could not decode that image"));
    img.src = url;
  });
}

/** Render the bitmap as a PNG data URL (handy for sharing the design). */
export function cellsToPng(cells: Cells, cols = COLS, scale = 12): string {
  const canvas = document.createElement("canvas");
  canvas.width = cols * scale;
  canvas.height = ROWS * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const ramp = ["#101917", "#14584f", "#1c8a6d", "#4fc98a", "#c8f751"];
  ctx.fillStyle = "#060908";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < cells.length; i++) {
    const level = clampLevel(cells[i]);
    if (!level) continue;
    ctx.fillStyle = ramp[level];
    const c = Math.floor(i / ROWS);
    const r = i % ROWS;
    ctx.fillRect(c * scale + 1, r * scale + 1, scale - 2, scale - 2);
  }
  return canvas.toDataURL("image/png");
}

export function cellsToAscii(cells: Cells, cols = COLS): string {
  const shades = [" ", "·", "▪", "▦", "█"];
  const rows: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) line += shades[clampLevel(cells[idx(c, r)])];
    rows.push(line);
  }
  return rows.join("\n");
}

export function downloadText(filename: string, text: string, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
