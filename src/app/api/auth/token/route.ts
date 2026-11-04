import { upsertGitHubConnection } from "@/lib/connections";
import { errorMessage, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Fallback: paste a personal access token instead of using OAuth. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = (body.token ?? "").trim();
  if (!token) return fail("token is required");

  try {
    const connection = await upsertGitHubConnection(token, "pat", "pat");
    return ok({ connection });
  } catch (err) {
    return fail(`Could not validate that token: ${errorMessage(err)}`, 401);
  }
}
