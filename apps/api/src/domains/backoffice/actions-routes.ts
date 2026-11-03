// Action routes of the backoffice v0 (docs/mvp/05 §K RG81, RG93, RG101 to RG104, RG108, CA58 to
// CA63; 15 §F, RG110; 03 §1.3 PD1 to PD7, §3.1; 17b §3.11, §3.13.c; 21 §J8 commit 6). Backoffice
// surface; the aal2 guard of server.ts runs first. This file is the single registration point; the
// routes live by sub-domain (PLK-1, 600 lines at most per file), each header carrying its own list:
// - actions-replay-routes.ts: lead replays and the lifting of a Brevo suppression;
// - actions-corrections-routes.ts: corrections of a member account (RG108);
// - actions-apollo-routes.ts: the Apollo settings read;
// - actions-dual-control-routes.ts: dual control, requests, views, confirmation, cancellation;
// - actions-alerts-routes.ts: the state alerts.
// The guards (admin only and its journaled refusal, CA63) are in action-guards.ts and re-exported
// here for the other route files of the domain.
import type { IdentityApp } from "../identity/routes.ts";
import type { BackofficeActionsDependencies } from "./action-guards.ts";
import { registerAlertRoutes } from "./actions-alerts-routes.ts";
import { registerApolloSettingsRoutes } from "./actions-apollo-routes.ts";
import { registerCorrectionRoutes } from "./actions-corrections-routes.ts";
import { registerDualControlRoutes } from "./actions-dual-control-routes.ts";
import { registerReplayRoutes } from "./actions-replay-routes.ts";

export {
  adminOnly,
  isForbidden,
  REFUSED,
  unlessRefused,
  type BackofficeActionsDependencies,
} from "./action-guards.ts";

export function registerBackofficeActionRoutes(
  app: IdentityApp,
  dependencies: BackofficeActionsDependencies,
): void {
  registerReplayRoutes(app, dependencies);
  registerCorrectionRoutes(app, dependencies);
  registerApolloSettingsRoutes(app, dependencies);
  registerDualControlRoutes(app, dependencies);
  registerAlertRoutes(app, dependencies);
}
