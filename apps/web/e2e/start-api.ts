// Starts apps/api for the browser journeys (playwright.config.ts): the configuration comes from the
// environment Playwright sets, plus what only the local stack knows. Run by Node directly.
// - The connection roles get their fixed LOCAL passwords (@influx/test-kit/db, loopback only).
// - SUPABASE_URL and SUPABASE_SECRET_KEY are read from `supabase status` (localAuthStack refuses
//   anything that is not the loopback), never from a `.env*` file, never written anywhere.
// Then the api's own entry point runs, unchanged, in this process.
import { localAuthStack, localRoleUrl } from "@influx/test-kit/db";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const local = localAuthStack();
process.env.SUPABASE_URL = local.apiUrl;
process.env.SUPABASE_SECRET_KEY = local.secretKey;
process.env.DATABASE_URL = localRoleUrl("influx_app");
process.env.AUTH_DATABASE_URL = localRoleUrl("influx_auth_login");
process.env.OPS_DATABASE_URL = localRoleUrl("influx_ops_login");

const apiMain = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../api/src/main.ts",
);
// A computed specifier: the api is typechecked by its own package, not through this file.
await import(pathToFileURL(apiMain).href);
