import { connectionWithToken, errorMessage, fail, ok } from "@/lib/api";
import { listRepos, rateLimit } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const connectionId = url.searchParams.get("connectionId");
  if (!connectionId) return fail("connectionId is required");

  const found = await connectionWithToken(connectionId);
  if (!found?.token) return fail("connection not found or token unreadable", 404);

  try {
    const [repos, limit] = await Promise.all([
      listRepos(found.token),
      rateLimit(found.token).catch(() => null),
    ]);
    return ok({
      repos: repos.map((r) => ({
        fullName: r.full_name,
        name: r.name,
        private: r.private,
        fork: r.fork,
        defaultBranch: r.default_branch,
        pushedAt: r.pushed_at,
      })),
      rateLimit: limit ? { remaining: limit.remaining, limit: limit.limit } : null,
    });
  } catch (err) {
    return fail(errorMessage(err), 502);
  }
}
