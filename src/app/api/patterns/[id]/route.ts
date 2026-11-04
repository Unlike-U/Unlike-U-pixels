import { eq } from "drizzle-orm";
import { db } from "@/db";
import { patterns } from "@/db/schema";
import { errorMessage, fail, ok } from "@/lib/api";
import { ROWS, clampLevel } from "@/lib/grid";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const [row] = await db.select().from(patterns).where(eq(patterns.id, id)).limit(1);
  if (!row) return fail("pattern not found", 404);
  return ok({ pattern: row });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    cells?: number[];
    starred?: boolean;
  };
  const [row] = await db.select().from(patterns).where(eq(patterns.id, id)).limit(1);
  if (!row) return fail("pattern not found", 404);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") patch.name = body.name.slice(0, 80);
  if (typeof body.starred === "boolean") patch.starred = body.starred;
  if (Array.isArray(body.cells)) {
    const size = row.width * ROWS;
    const cells = new Array(size).fill(0);
    body.cells.slice(0, size).forEach((v, i) => {
      cells[i] = clampLevel(Number(v) || 0);
    });
    patch.cells = cells;
  }

  try {
    await db.update(patterns).set(patch).where(eq(patterns.id, id));
    const [fresh] = await db.select().from(patterns).where(eq(patterns.id, id)).limit(1);
    return ok({ pattern: fresh });
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await db.delete(patterns).where(eq(patterns.id, id));
    return ok({ deleted: id });
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}
