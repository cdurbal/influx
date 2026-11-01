// The correspondence table of 05 RG99: the raw codes of the worker (skip reasons of the connectors,
// error codes of the providers, 0111) become a cause in clear and its nature (RG100). The table is
// the only place where a raw code is read for the screen: what leaves apps/api is the closed code
// of @influx/contracts/backoffice-accounts, translated by apps/backoffice (D36 open). An unknown
// code is never passed through: it becomes other_normal_case or other_failure.
import type {
  SyncCause,
  SyncNature,
  SyncSetting,
  SyncState,
  SyncStatus,
} from "@influx/contracts/backoffice-accounts";

/** Skip reasons (status skipped): a normal case, never a failure (outbox_status, 0101). */
const SKIP_CAUSES: Readonly<Record<string, SyncCause>> = {
  no_consent: "no_consent",
  out_of_apollo_scope_individual: "out_of_apollo_scope_individual",
  out_of_apollo_scope: "out_of_apollo_scope",
  country_excluded: "country_excluded",
  country_not_validated: "country_not_validated",
  prospection_opposed: "prospection_opposed",
  email_not_verified: "email_not_verified",
  company_not_identified: "company_not_identified",
  account_absent: "account_not_active",
  account_not_active: "account_not_active",
  role_out_of_scope: "account_not_active",
  skipped_non_production: "non_production",
  skipped_no_credentials: "non_production",
};

/**
 * 05 RG160: what an INFLUX setting lacks is an incident, never a normal case. The code of the line
 * names the setting (RG164); a Brevo list is that of the role of the account. Never a value.
 */
function configurationSetting(
  code: string,
  role: MemberRole,
): SyncSetting | null {
  switch (code) {
    case "list_not_configured":
      return role === "advertiser"
        ? "brevo_list_advertisers"
        : "brevo_list_creators";
    case "template_not_configured":
      return "brevo_template";
    case "apollo_settings_invalid":
      return "apollo_settings";
    case "credentials_missing":
      return "apollo_credentials";
    default:
      return null;
  }
}

export type MemberRole = "advertiser" | "creator";

/** Error codes, without their provider prefix (`brevo.rejected` ⇒ `rejected`). */
const ERROR_CAUSES: Readonly<Record<string, SyncCause>> = {
  rejected: "address_refused",
  rate_limited: "quota_exceeded",
  unreachable: "service_unavailable",
  unavailable: "service_unavailable",
  worker_interrupted: "service_unavailable",
  unauthorized: "access_key_refused",
  output_check_rejected: "data_refused_by_check",
  no_contact_id: "provider_response_invalid",
  no_message_id: "provider_response_invalid",
};

function errorCause(code: string | null): SyncCause {
  if (code === null) {
    return "other_failure";
  }
  if (configurationSetting(code, "creator") !== null) {
    return "configuration_missing";
  }
  const bare = code.replace(/^(?:brevo|apollo)\./, "");
  return ERROR_CAUSES[bare] ?? "other_failure";
}

/** The raw state of one destination, as the repository reads it. */
export type RawSyncState = {
  /** A live line (pending or processing) of this destination, if any. */
  liveStatus: "pending" | "processing" | null;
  liveAttempts: number | null;
  liveAvailableAt: string | null;
  /** leads.contact_sync_states.last_status, null without any recorded attempt. */
  lastStatus: string | null;
  /** The skip reason or the error code of that last outcome (0111). */
  lastCode: string | null;
  lastAttemptAt: string | null;
};

/** The state filter of the list, computed the same way in SQL (accounts/repository.ts). */
export function syncStateOf(raw: RawSyncState): SyncState {
  if (raw.liveStatus !== null) {
    return "pending";
  }
  switch (raw.lastStatus) {
    case null:
      return "not_attempted";
    case "succeeded":
      return "synced";
    case "skipped":
      return "skipped";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

/** RG99, RG100: the state, the nature and the cause in clear of one destination. */
export function syncStatusOf(raw: RawSyncState, role: MemberRole): SyncStatus {
  const state = syncStateOf(raw);
  const base = {
    state,
    retryAt: null,
    setting: null,
    lastAttemptAt: raw.lastAttemptAt,
  };
  switch (state) {
    case "synced":
      return { ...base, nature: "success", cause: "synced" };
    case "not_attempted":
      return { ...base, nature: "in_progress", cause: "not_attempted" };
    case "pending": {
      const retrying =
        raw.liveStatus === "pending" && (raw.liveAttempts ?? 0) > 0;
      return retrying
        ? {
            ...base,
            nature: "in_progress",
            cause: "retry_scheduled",
            retryAt: raw.liveAvailableAt,
          }
        : { ...base, nature: "in_progress", cause: "waiting" };
    }
    case "skipped": {
      // a configuration skip (before 0146 reclassified them) is still an incident, never normal
      const setting =
        raw.lastCode === null ? null : configurationSetting(raw.lastCode, role);
      if (setting !== null) {
        return {
          ...base,
          nature: "incident",
          cause: "configuration_missing",
          setting,
        };
      }
      return {
        ...base,
        nature: "normal_case",
        cause:
          (raw.lastCode === null ? undefined : SKIP_CAUSES[raw.lastCode]) ??
          "other_normal_case",
      };
    }
    case "failed": {
      const cause = errorCause(raw.lastCode);
      const nature: SyncNature =
        cause === "access_key_refused" || cause === "configuration_missing"
          ? "incident"
          : "failure";
      const setting =
        cause === "configuration_missing" && raw.lastCode !== null
          ? configurationSetting(raw.lastCode, role)
          : null;
      return { ...base, nature, cause, setting };
    }
  }
}
