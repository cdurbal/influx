// The recorder of the manual trial (docs/mvp/16 RG115, RG148; D62; J6 commit 7): the exchanges
// with Brevo and Apollo captured around the real fetch, then redacted before any of them becomes
// a fixture of packages/test-kit. No network here: the inner fetch is a stub.
import { describe, expect, it } from "vitest";
import {
  recordingFetch,
  redactRecords,
  type ProviderRecord,
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
      "Camille Real",
      "Head of Partnerships",
      "7946",
    ]) {
      expect(text).not.toContain(real);
    }
  });

  it("keeps the shape: names, codes, short tokens, empty strings, numbers, consistent ids", () => {
    const [brevo, smtp, apollo] = redactRecords(recorded);
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
      message: "Contact recorded-contact-1@example.test already in list",
    });
    expect(smtp?.requestBody).toEqual({
      to: [{ email: "recorded-contact-1@example.test" }],
      params: { LANGUAGE: "en" },
    });
    expect(smtp?.responseBody).toEqual({
      messageId: "<000000000000.00000000001@smtp-relay.mailin.fr>",
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
