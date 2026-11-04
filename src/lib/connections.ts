import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema";
import { encrypt } from "./crypto";
import { getUser, resolveCommitEmail } from "./github";
import { newId } from "./paint";

export type ConnectionMode = "oauth" | "pat";

export type UpsertResult = {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
  scope: string;
  mode: ConnectionMode;
};

/**
 * Validates a token against /user and stores (or refreshes) the connection.
 * Shared by the OAuth callback, the device flow poller and the PAT route.
 */
export async function upsertGitHubConnection(
  token: string,
  mode: ConnectionMode,
  scope: string,
): Promise<UpsertResult> {
  const me = await getUser(token);
  const email = await resolveCommitEmail(token, me.login, me.id);

  const existing = await db
    .select({ id: connections.id })
    .from(connections)
    .where(eq(connections.githubId, String(me.id)))
    .limit(1);

  const id = existing[0]?.id ?? newId("cn");
  const values = {
    id,
    provider: "github",
    mode,
    githubId: String(me.id),
    login: me.login,
    avatarUrl: me.avatar_url,
    name: me.name,
    email,
    scope,
    tokenCipher: encrypt(token),
    lastUsedAt: new Date(),
  };

  if (existing[0]) {
    await db.update(connections).set(values).where(eq(connections.id, id));
  } else {
    await db.insert(connections).values(values);
  }

  return {
    id,
    login: me.login,
    name: me.name,
    avatarUrl: me.avatar_url,
    email,
    scope,
    mode,
  };
}
