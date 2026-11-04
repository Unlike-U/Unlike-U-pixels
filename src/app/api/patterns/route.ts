import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { patterns } from "@/db/schema";
import { clampInt, errorMessage, fail, ok } from "@/lib/api";
import { newId } from "@/lib/paint";
import { COLS, ROWS, clampLevel } from "@/lib/grid";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const connectionId = url.searchParams.get("connectionId");
  try {
    const rows = connectionId
      ? await db.select().from(patterns).where(eq(patterns.connectionId, connectionId)).orderBy(desc(patterns.updatedAt))
      : await db.select().from(patterns).orderBy(desc(patterns.updatedAt)).limit(60);
    return ok({ patterns: rows });
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    cells?: number[];
    connectionId?: string | null;
    source?: string;
    width?: number;
  };
  if (!Array.isArray(body.cells)) return fail("cells array is required");

  const width = clampInt(body.width ?? COLS, 4, COLS, COLS);
  const cells = new Array(width * ROWS).fill(0);
  body.cells.slice(0, width * ROWS).forEach((v, i) => {
    cells[i] = clampLevel(Number(v) || 0);
  });

  try {
    const row = {
      id: newId("pat"),
      connectionId: body.connectionId ?? null,
      name: (body.name ?? "Untitled bitmap").slice(0, 80),
      width,
      height: ROWS,
      cells,
      palette: "moss",
      source: body.source ?? "editor",
      createdAt: new Date(),
      updatedAt: new Date(),
      starred: false,
    };
    await db.insert(patterns).values(row);
    return ok({ pattern: row }, { status: 201 });
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}
