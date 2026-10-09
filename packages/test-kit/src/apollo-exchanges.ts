// The exchanges the Apollo double answers from (docs/mvp/16 RG148 applied to Apollo, skill
// apollo-lead-sync "Tests"): one request and its answer per Apollo operation INFLUX uses, by the
// Apollo REST API v1. Their shape is DRAFTED from Apollo's public reference (contacts: create with
// `run_dedupe`, update by id), not recorded: the redacted recordings of the manual trial (D62, J6
// commit 7) replace the bodies below, field for field, without changing the double. Nothing here
// is a real identifier, a real address or a key.
//
// The answers carry what Apollo adds of its own (enrichment: title, phone, organisation…): INFLUX
// reads back the contact id and NOTHING else (05 RG85), and the tests prove it on these values.

export type RecordedExchange = {
  /** What INFLUX sends, as recorded (addresses replaced by a placeholder of example.test). */
  request: {
    method: "POST" | "PUT";
    path: string;
    body?: unknown;
  };
  response: {
    status: number;
    headers?: Record<string, string>;
    body?: unknown;
  };
};

/** What Apollo would add to a contact by enrichment: never read back by INFLUX (05 RG85). */
export const ENRICHED_FIELDS = {
  title: "Head of Partnerships (enriched)",
  linkedin_url: "https://www.linkedin.example/in/enriched-profile",
  phone_numbers: [{ raw_number: "+32 2 555 01 99", type: "work_direct" }],
  organization: {
    name: "Enriched Organisation SA",
    website_url: "https://enriched-organisation.example",
    estimated_num_employees: 240,
  },
} as const;

/** Create: a new contact (`run_dedupe`), answered with its id and Apollo's own fields. */
export const CONTACT_CREATED: RecordedExchange = {
  request: {
    method: "POST",
    path: "/api/v1/contacts",
    body: {
      email: "recorded-contact@example.test",
      organization_name: "Recorded Company",
      label_names: ["influx", "influx_profile_advertiser"],
      run_dedupe: true,
    },
  },
  response: {
    status: 200,
    body: {
      contact: {
        id: "65f0c0ffee0000000000a001",
        email: "recorded-contact@example.test",
        ...ENRICHED_FIELDS,
      },
    },
  },
};

/** Update by id: the known contact, answered with its id and Apollo's own fields. */
export const CONTACT_UPDATED: RecordedExchange = {
  request: {
    method: "PUT",
    path: "/api/v1/contacts/65f0c0ffee0000000000a001",
    body: { label_names: ["influx", "influx_profile_advertiser"] },
  },
  response: {
    status: 200,
    body: {
      contact: {
        id: "65f0c0ffee0000000000a001",
        email: "recorded-contact@example.test",
        ...ENRICHED_FIELDS,
      },
    },
  },
};

/** Update of an id Apollo no longer knows (deleted on its side). */
export const CONTACT_NOT_FOUND: RecordedExchange = {
  request: {
    method: "PUT",
    path: "/api/v1/contacts/65f0c0ffee0000000000dead",
  },
  response: { status: 404, body: { error: "Contact not found" } },
};

/** The rate limit or the quota of the plan. */
export const TOO_MANY_REQUESTS: RecordedExchange = {
  request: { method: "POST", path: "/api/v1/contacts" },
  response: {
    status: 429,
    headers: { "retry-after": "60" },
    body: { error: "rate limit exceeded" },
  },
};

/** A refused key. */
export const UNAUTHORIZED: RecordedExchange = {
  request: { method: "POST", path: "/api/v1/contacts" },
  response: {
    status: 401,
    body: { error: "Invalid access credentials." },
  },
};

/** A body Apollo refuses (an invalid field). */
export const UNPROCESSABLE: RecordedExchange = {
  request: { method: "POST", path: "/api/v1/contacts" },
  response: { status: 422, body: { error: "Email is invalid" } },
};
