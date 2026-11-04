import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema";
import { decrypt } from "./crypto";

export const ok = <T,>(data: T, init?: ResponseInit) => NextResponse.json(data, init);

export const fail = (message: string, status = 400, extra?: Record<string, unknown>) =>
  NextResponse.json({ error: message, ...extra }, { status });

export function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Loads a connection and decrypts its token. */
export async function connectionWithToken(connectionId: string) {
  const [conn] = await db
    .select()
    .from(connections)
    .where(eq(connections.id, connectionId))
    .limit(1);
  if (!conn) return null;
  const token = decrypt(conn.tokenCipher);
  return { conn, token };
}

export function publicConnection(conn: {
  id: string;
  login: string;
  mode: string;
  githubId: string | null;
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
  scope: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}) {
  return conn;
}

export const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
};
