// The recorder of the manual trial (docs/mvp/16 RG115, RG148; D62; J6 commit 7): the exchanges
// with Brevo and Apollo captured around the real fetch, then redacted before any of them becomes
// a fixture of packages/test-kit. No network here: the inner fetch is a stub. J7 commit 10: the
// redaction closed by default, and its refusals (expert-cybersecurite, blocking).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  findLeaks,
  recordingFetch,
  redactFile,
  redactRecords,
  type ProviderRecord,
  type TrialRecord,
} from "../scripts/provider-recording.ts";

const PERSONA = "founder+creator-1@internal.example";
const ACCOUNT_ID = "4b0c2f9e-7d1a-4c55-9a7e-3e2f1d0c9b8a";
const APOLLO_ID = "66a1b2c3d4e5f60718293a4b";

function stub(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const inner = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  }) as typeof fetch;
  return { inner, calls };
}

describe("recordingFetch", () => {
  it("records a Brevo exchange without any request header, the answer still readable", async () => {
    const records: ProviderRecord[] = [];
    const { inner } = stub(
      201,
      { id: 4242 },
      { "x-sib-ratelimit-remaining": "9", "set-cookie": "a=b" },
    );
    const doFetch = recordingFetch(inner, (record) => records.push(record));

    const response = await doFetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "api-key": "xkeysib-secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: PERSONA, updateEnabled: true }),
    });

    expect(await response.json()).toEqual({ id: 4242 });
    expect(records).toEqual([
      {
        provider: "brevo",
        method: "POST",
        path: "/v3/contacts",
        requestBody: { email: PERSONA, updateEnabled: true },
        status: 201,
        headers: {
          "content-type": "application/json",
          "x-sib-ratelimit-remaining": "9",
        },
        responseBody: { id: 4242 },
      },
    ]);
    expect(JSON.stringify(records)).not.toContain("xkeysib-secret");
  });

  it("records Apollo, and nothing of another host (the local Supabase)", async () => {
    const records: ProviderRecord[] = [];
    const { inner, calls } = stub(200, { contact: { id: APOLLO_ID } });
    const doFetch = recordingFetch(inner, (record) => records.push(record));

    await doFetch("http://127.0.0.1:54321/auth/v1/otp", {
      method: "POST",
      body: "{}",
    });
    await doFetch("https://api.apollo.io/api/v1/contacts", {
      method: "POST",
      headers: { "x-api-key": "apollo-secret" },
      body: JSON.stringify({ email: PERSONA }),
    });

    expect(calls).toHaveLength(2);
    expect(records.map((record) => [record.provider, record.path])).toEqual([
      ["apollo", "/api/v1/contacts"],
    ]);
    expect(JSON.stringify(records)).not.toContain("apollo-secret");
  });
});

describe("redactRecords", () => {
  const recorded: ProviderRecord[] = [
    {
      provider: "brevo",
      method: "PUT",
      path: `/v3/contacts/${encodeURIComponent(PERSONA)}`,
      requestBody: {
        email: PERSONA,
        attributes: {
          INFLUX_ACCOUNT_ID: ACCOUNT_ID,
          FIRSTNAME: "Camille Real",
          LANGUAGE: "fr",
          SIGNUP_DATE: "",
        },
        listIds: [12],
      },
      status: 400,
      headers: {},
      responseBody: {
        code: "invalid_parameter",
        message: `Contact ${PERSONA} already in list`,
      },
    },
    {
      provider: "brevo",
      method: "POST",
      path: "/v3/smtp/email",
      requestBody: { to: [{ email: PERSONA }], params: { LANGUAGE: "en" } },
      status: 201,
      headers: {},
      responseBody: {
        messageId: "<202610091200.12345678901@smtp-relay.mailin.fr>",
      },
    },
    {
      provider: "apollo",
      method: "PUT",
      path: `/api/v1/contacts/${APOLLO_ID}`,
      requestBody: { label_names: ["influx", "influx_profile_creator"] },
      status: 200,
      headers: {},
      responseBody: {
        contact: {
          id: APOLLO_ID,
          owner_id: "5f9e8d7c6b5a49382716a0b1",
          email: PERSONA,
          title: "Head of Partnerships",
          phone_numbers: [{ raw_number: "+44 20 7946 0000" }],
          email_status: "verified",
          existence_level: 3,
        },
      },
    },
  ];

  it("leaves no address, account id, provider id, free text or phone", () => {
    const text = JSON.stringify(redactRecords(recorded));
    for (const real of [
      PERSONA,
      encodeURIComponent(PERSONA),
      "internal.example",
      ACCOUNT_ID,
      APOLLO_ID,
      "5f9e8d7c6b5a49382716a0b1",
      "12345678901",
      "smtp-relay.mailin.fr",
      "Camille Real",
      "Head of Partnerships",
      "7946",
    ]) {
      expect(text).not.toContain(real);
    }
  });

  it("keeps the shape: names, codes, allowed values, empty strings, numbers, consistent ids", () => {
    const [brevo, smtp, apollo] = redactRecords(recorded) as ProviderRecord[];
    expect(brevo?.path).toBe("/v3/contacts/recorded-contact-1%40example.test");
    expect(brevo?.requestBody).toEqual({
      email: "recorded-contact-1@example.test",
      attributes: {
        INFLUX_ACCOUNT_ID: "00000000-0000-4000-8000-000000000001",
        FIRSTNAME: "redacted",
        LANGUAGE: "fr",
        SIGNUP_DATE: "",
      },
      listIds: [12],
    });
    expect(brevo?.responseBody).toEqual({
      code: "invalid_parameter",
      // Closed by default (J7 commit 10): a provider's text is not an allowed value.
      message: "redacted",
    });
    expect(smtp?.requestBody).toEqual({
      to: [{ email: "recorded-contact-1@example.test" }],
      params: { LANGUAGE: "en" },
    });
    expect(smtp?.responseBody).toEqual({
      messageId: "<000000000000.00000000001@example.test>",
    });
    expect(apollo?.path).toBe("/api/v1/contacts/65f0c0ffee0000000000a001");
    expect(apollo?.responseBody).toEqual({
      contact: {
        id: "65f0c0ffee0000000000a001",
        owner_id: "65f0c0ffee0000000000a002",
        email: "recorded-contact-1@example.test",
        title: "redacted",
        phone_numbers: [{ raw_number: "redacted" }],
        email_status: "verified",
        existence_level: 3,
      },
    });
  });
});

describe("redactRecords, closed by default (J7 commit 10)", () => {
  const MESSAGE_ID = "<202610141000.98765432101@smtp-relay.mailin.fr>";
  const recorded: TrialRecord[] = [
    {
      kind: "inbound",
      receivedAt: "2026-10-14T10:06:00.123Z",
      contentType: "application/json; charset=utf-8",
      body: {
        id: 4417,
        event: "unsubscribed",
        email: PERSONA,
        "message-id": MESSAGE_ID,
        subject: "Your private offer",
        sending_ip: "185.41.28.109",
        link: "https://track.example/abc",
        date: "2026-10-14 10:05:00",
        ts_event: 1792231500,
        reason: "550 user unknown",
        tag: "",
        list_id: [3],
      },
    },
    {
      provider: "brevo",
      method: "GET",
      path: "/v3/contacts",
      requestBody: undefined,
      status: 200,
      headers: { "content-type": "application/json" },
      responseBody: {
        contacts: [
          {
            email: PERSONA,
            id: 21,
            emailBlacklisted: true,
            createdAt: "2026-10-01T09:00:00.000+02:00",
            modifiedAt: "2026-10-14T10:05:00.000+02:00",
            attributes: {
              INFLUX_ACCOUNT_ID: ACCOUNT_ID,
              FIRSTNAME: "Camille Real",
              LANGUAGE: "fr",
              COUNTRY: "GB",
              SMS: "+447700900123",
            },
            listIds: [2],
          },
        ],
        count: 1,
      },
    },
    {
      provider: "brevo",
      method: "GET",
      path: "/v3/smtp/statistics/events",
      requestBody: undefined,
      status: 200,
      headers: {},
      responseBody: {
        events: [
          {
            email: PERSONA,
            date: "2026-10-14T10:05:00.000+02:00",
            messageId: MESSAGE_ID,
            event: "spam",
            subject: "Recorded subject",
            tag: "campaign-alpha",
            from: "no-reply@tx.influx.example",
            ip: "2001:db8::1",
            templateId: 3,
          },
        ],
      },
    },
  ];

  it("keeps the allowed keys' values, replaces every other string, links the same ids", () => {
    const [inbound, contacts, events] = redactRecords(recorded);
    expect(inbound).toEqual({
      kind: "inbound",
      receivedAt: "2000-01-01T00:00:00.000Z",
      contentType: "application/json",
      body: {
        id: 4417,
        event: "unsubscribed",
        email: "recorded-contact-1@example.test",
        "message-id": "<000000000000.00000000001@example.test>",
        subject: "redacted",
        sending_ip: "redacted",
        link: "redacted",
        date: "2000-01-01 00:00:00",
        ts_event: 1792231500,
        reason: "redacted",
        tag: "",
        list_id: [3],
      },
    });
    expect((contacts as ProviderRecord).responseBody).toEqual({
      contacts: [
        {
          email: "recorded-contact-1@example.test",
          id: 21,
          emailBlacklisted: true,
          createdAt: "2000-01-01T00:00:00.000+00:00",
          modifiedAt: "2000-01-01T00:00:00.000+00:00",
          attributes: {
            INFLUX_ACCOUNT_ID: "00000000-0000-4000-8000-000000000001",
            FIRSTNAME: "redacted",
            LANGUAGE: "fr",
            COUNTRY: "GB",
            SMS: "redacted",
          },
          listIds: [2],
        },
      ],
      count: 1,
    });
    expect((events as ProviderRecord).responseBody).toEqual({
      events: [
        {
          email: "recorded-contact-1@example.test",
          date: "2000-01-01T00:00:00.000+00:00",
          messageId: "<000000000000.00000000001@example.test>",
          event: "spam",
          subject: "redacted",
          tag: "redacted",
          from: "recorded-contact-2@example.test",
          ip: "redacted",
          templateId: 3,
        },
      ],
    });
  });

  it("replaces an allowed value under a key that is not allowed", () => {
    const [record] = redactRecords([
      {
        kind: "inbound",
        receivedAt: "2026-10-14T10:06:00.000Z",
        contentType: "application/json",
        body: { event: "spam", subject: "spam", reason: "unsubscribed" },
      },
    ]);
    expect(record).toMatchObject({
      body: { event: "spam", subject: "redacted", reason: "redacted" },
    });
  });

  it("finds nothing to refuse in its own output", () => {
    expect(findLeaks(recorded, redactRecords(recorded))).toEqual([]);
  });
});

describe("findLeaks: the refusals of `redact` (J7 commit 10)", () => {
  const raw: TrialRecord[] = [
    {
      kind: "inbound",
      receivedAt: "2026-10-14T10:06:00.000Z",
      contentType: "application/json",
      body: { event: "unsubscribed", subject: "Hello Camille", short: "Alice" },
    },
  ];
  const leaking = (body: Record<string, unknown>): TrialRecord[] => [
    {
      kind: "inbound",
      receivedAt: "2000-01-01T00:00:00.000Z",
      contentType: "application/json",
      body,
    },
  ];

  it("refuses an address outside example.test", () => {
    const reason = ["record 0: an address outside example.test"];
    expect(
      findLeaks(raw, leaking({ email: "someone@elsewhere.example" })),
    ).toEqual(reason);
    expect(findLeaks(raw, leaking({ email: "a@example.test.evil" }))).toEqual(
      reason,
    );
    expect(findLeaks(raw, leaking({ email: "a@example.test" }))).toEqual([]);
  });

  it("refuses an http:// or https:// URL", () => {
    const reason = ["record 0: a URL"];
    expect(findLeaks(raw, leaking({ link: "see http://x.test" }))).toEqual(
      reason,
    );
    expect(findLeaks(raw, leaking({ link: "HTTPS://x.test" }))).toEqual(reason);
  });

  it("refuses an IPv4 address", () => {
    expect(findLeaks(raw, leaking({ ip: "from 10.1.2.3" }))).toEqual([
      "record 0: an IPv4 address",
    ]);
  });

  it("refuses an IPv6 address, full or compressed, but not a time", () => {
    const reason = ["record 0: an IPv6 address"];
    expect(findLeaks(raw, leaking({ ip: "2001:db8::1" }))).toEqual(reason);
    expect(
      findLeaks(
        raw,
        leaking({ ip: "2001:0db8:0000:0000:0000:ff00:0042:8329" }),
      ),
    ).toEqual(reason);
    expect(
      findLeaks(raw, leaking({ date: "2000-01-01 10:05:00+00:00" })),
    ).toEqual([]);
  });

  it("refuses a raw string of 6 characters or more, alone, inside a text or as a key", () => {
    const reason = ["record 0: a raw string that is not an allowed value"];
    expect(findLeaks(raw, leaking({ subject: "Hello Camille" }))).toEqual(
      reason,
    );
    expect(findLeaks(raw, leaking({ text: "Re: Hello Camille!" }))).toEqual(
      reason,
    );
    expect(findLeaks(raw, leaking({ "Hello Camille": 1 }))).toEqual(reason);
  });

  it("lets an allowed value and a raw string under 6 characters through", () => {
    expect(
      findLeaks(raw, leaking({ event: "unsubscribed", short: "Alice" })),
    ).toEqual([]);
  });

  it("never quotes the value it found", () => {
    const leaks = findLeaks(
      raw,
      leaking({ subject: "Hello Camille", email: "someone@elsewhere.example" }),
    ).join(" ");
    expect(leaks).not.toContain("Camille");
    expect(leaks).not.toContain("elsewhere");
  });
});

describe("redactFile, the `redact` mode", () => {
  const raw: TrialRecord[] = [
    {
      kind: "inbound",
      receivedAt: "2026-10-14T10:06:00.000Z",
      contentType: "application/json",
      body: { event: "spam", email: PERSONA, subject: "Hello Camille" },
    },
  ];
  const files = () => {
    const directory = mkdtempSync(path.join(tmpdir(), "influx-redact-"));
    const rawPath = path.join(directory, "raw.jsonl");
    writeFileSync(
      rawPath,
      raw.map((record) => `${JSON.stringify(record)}\n`).join(""),
    );
    return { rawPath, redactedPath: path.join(directory, "redacted.json") };
  };

  it("writes the redacted records when nothing leaks", () => {
    const { rawPath, redactedPath } = files();
    expect(redactFile(rawPath, redactedPath)).toBe(1);
    expect(JSON.parse(readFileSync(redactedPath, "utf8"))).toEqual(
      redactRecords(raw),
    );
  });

  it("writes nothing when the redaction lets anything through", () => {
    const { rawPath, redactedPath } = files();
    expect(() =>
      redactFile(rawPath, redactedPath, (records) => [...records]),
    ).toThrow(/redacted\.json NOT written/);
    expect(existsSync(redactedPath)).toBe(false);
  });
});

describe("the raw recordings are never committed", () => {
  it("git ignores apps/api/.provider-recordings/raw.jsonl and redacted.json", () => {
    const root = path.join(import.meta.dirname, "..", "..", "..");
    for (const file of ["raw.jsonl", "redacted.json"]) {
      // check-ignore exits 1, and execFileSync throws, when the path is NOT ignored.
      expect(() =>
        execFileSync(
          "git",
          [
            "check-ignore",
            "--quiet",
            "--no-index",
            `apps/api/.provider-recordings/${file}`,
          ],
          { cwd: root },
        ),
      ).not.toThrow();
    }
  });
});
