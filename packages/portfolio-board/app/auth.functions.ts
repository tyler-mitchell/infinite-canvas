import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { createAuth } from "../server/auth.ts";

export const getSignInProviders = createServerFn({ method: "GET" }).handler(async () => {
  if (!env.BETTER_AUTH_SECRET || !env.BETTER_AUTH_URL) return [];
  const { socialProviders } = await createAuth(env).$context;
  return socialProviders.map(({ id, name }) => ({ id, name }));
});
