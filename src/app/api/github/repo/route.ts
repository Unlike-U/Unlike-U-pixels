import { connectionWithToken, errorMessage, fail, ok } from "@/lib/api";
import { ensureRepo } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    connectionId?: string;
    name?: string;
    private?: boolean;
  };
  if (!body.connectionId) return fail("connectionId is required");
  const name = (body.name ?? "").trim().replace(/[^a-zA-Z0-9._-]/g, "-");
  if (!name) return fail("repo name is required");

  const found = await connectionWithToken(body.connectionId);
  if (!found?.token) return fail("connection not found or token unreadable", 404);

  try {
    const repo = await ensureRepo(found.token, name, Boolean(body.private));
    return ok({
      repo: {
        fullName: repo.full_name,
        name: repo.name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        url: `https://github.com/${repo.full_name}`,
      },
    });
  } catch (err) {
    return fail(errorMessage(err), 502);
  }
}
