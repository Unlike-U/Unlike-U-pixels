import { desc } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema";
import { readOAuthStatus } from "@/lib/oauth";
import { errorMessage, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: connections.id,
        login: connections.login,
        name: connections.name,
        avatarUrl: connections.avatarUrl,
        email: connections.email,
        mode: connections.mode,
        scope: connections.scope,
        createdAt: connections.createdAt,
        lastUsedAt: connections.lastUsedAt,
      })
      .from(connections)
      .orderBy(desc(connections.createdAt));
    const oauth = await readOAuthStatus();
    return ok({
      connections: rows,
      oauth,
    });
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}
