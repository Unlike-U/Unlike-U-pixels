import { connectionWithToken, errorMessage, fail, ok } from "@/lib/api";
import { fetchContributions } from "@/lib/github";
import { COLS, ROWS, clampLevel } from "@/lib/grid";
import type { Cells } from "@/lib/grid";

export const dynamic = "force-dynamic";

/** Flatten GitHub's contribution calendar into a 53x7 column-major bitmap. */
function calendarToCells(weeks: { level: number }[][]): Cells {
  const cells = new Array< number>(COLS * ROWS).fill(0);
  const last = weeks.slice(-COLS);
  const offset = COLS - last.length;
  last.forEach((week, wi) => {
    const col = wi + offset;
    for (let d = 0; d < ROWS; d++) {
      const day = week[d];
      cells[col * ROWS + d] = clampLevel(day?.level ?? 0);
    }
  });
  return cells;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const connectionId = url.searchParams.get("connectionId");
  const login = url.searchParams.get("login") ?? "";
  if (!connectionId) return fail("connectionId is required");
  if (!login) return fail("login is required");

  const found = await connectionWithToken(connectionId);
  if (!found?.token) return fail("connection not found or token unreadable", 404);

  try {
    const grid = await fetchContributions(found.token, login);
    return ok({
      login: grid.login,
      total: grid.total,
      weeks: grid.weeks.length,
      cells: calendarToCells(grid.weeks),
      calendar: grid.weeks.map((w) => w.map((d) => ({ level: d.level, count: d.count, date: d.date }))),
    });
  } catch (err) {
    return fail(errorMessage(err), 502);
  }
}
