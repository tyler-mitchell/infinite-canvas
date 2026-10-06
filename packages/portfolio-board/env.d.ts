import type { AuthBindings } from "./server/auth.ts";
import type { D1Database } from "@cloudflare/workers-types";

declare global {
  namespace Cloudflare {
    interface Env extends AuthBindings {
      DB: D1Database;
    }
  }
}
