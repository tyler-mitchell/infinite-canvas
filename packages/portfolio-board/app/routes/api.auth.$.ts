import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { createAuth } from "../../server/auth.ts";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: handleAuth,
      POST: handleAuth,
    },
  },
});

function handleAuth({ request }: { request: Request }) {
  if (!env.BETTER_AUTH_SECRET || !env.BETTER_AUTH_URL) {
    return Response.json({ error: "Sign-in is not configured." }, { status: 503 });
  }
  return createAuth(env).handler(request);
}
