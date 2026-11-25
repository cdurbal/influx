// The requests of a route synthesised from its own schemas (parameters, query, body), shared by the
// sweeps that call EVERY route of the server's inventory: T1 (t1-anonymisation, by value) and T9.6
// (t9-evidence-unreachable, the identifiers of a real piece in every slot). Moved out of T1 as it
// was (L2E commit 17): nothing here knows a route by name, and nothing parses a response.
import { randomUUID } from "node:crypto";
import * as z from "zod";
import type { InventoriedRoute } from "../src/server.ts";

export type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type JsonSchema = Readonly<Record<string, unknown>>;

function isZodSchema(value: unknown): value is z.ZodType {
  return typeof value === "object" && value !== null && "_zod" in value;
}

/** The JSON Schema of a zod input, or null when it has none (a raw body, no schema). */
function jsonSchemaOf(schema: unknown): JsonSchema | null {
  if (!isZodSchema(schema)) {
    return null;
  }
  try {
    return z.toJSONSchema(schema, {
      io: "input",
      unrepresentable: "any",
    }) as JsonSchema;
  } catch {
    return {};
  }
}

function asSchema(value: unknown): JsonSchema | null {
  return typeof value === "object" && value !== null
    ? (value as JsonSchema)
    : null;
}

/** Follows a local `$ref` (`#` or `#/$defs/name`). */
function resolved(schema: JsonSchema, root: JsonSchema): JsonSchema {
  const ref = schema.$ref;
  if (typeof ref !== "string") {
    return schema;
  }
  if (ref === "#") {
    return root;
  }
  const name = ref.replace(/^#\/(\$defs|definitions)\//, "");
  const defs = asSchema(root.$defs) ?? asSchema(root.definitions) ?? {};
  return asSchema(defs[name]) ?? {};
}

/** Strings likely to satisfy the shapes of the contracts: tried in order against each pattern. */
function stringCandidates(uuid: string): string[] {
  return [
    "t1-sweep@example.test",
    "https://www.example.test/t1-sweep",
    "+33600000001",
    "123456",
    "FR",
    "fr",
    "instagram",
    "x",
    uuid,
    "2026-01-01",
    "2026-01-01T00:00:00.000Z",
    "0".repeat(64),
    "sweep_value",
    "Valeur de balayage",
  ];
}

function matchesPattern(value: string, pattern: string): boolean {
  try {
    return new RegExp(pattern, "u").test(value);
  } catch {
    try {
      return new RegExp(pattern).test(value);
    } catch {
      return true;
    }
  }
}

function sampleString(schema: JsonSchema, uuid: string): string {
  const format = schema.format;
  if (format === "email") {
    return "t1-sweep@example.test";
  }
  if (format === "uuid" || format === "guid") {
    return uuid;
  }
  if (format === "date-time") {
    return new Date().toISOString();
  }
  if (format === "date") {
    return "2026-01-01";
  }
  if (format === "uri" || format === "url") {
    return "https://www.example.test/t1-sweep";
  }
  const min = typeof schema.minLength === "number" ? schema.minLength : 0;
  const max =
    typeof schema.maxLength === "number"
      ? schema.maxLength
      : Number.POSITIVE_INFINITY;
  const pattern = typeof schema.pattern === "string" ? schema.pattern : null;
  const fit = stringCandidates(uuid).find(
    (candidate) =>
      candidate.length >= min &&
      candidate.length <= max &&
      (pattern === null || matchesPattern(candidate, pattern)),
  );
  return fit ?? "x".repeat(Math.max(1, Math.min(min, 4096)));
}

/** A value of the schema, best effort: a body that fails its schema is a case of T1.4. */
function sample(
  value: unknown,
  root: JsonSchema,
  uuid: string,
  depth = 0,
): unknown {
  const raw = asSchema(value);
  if (raw === null || depth > 10) {
    return null;
  }
  const schema = resolved(raw, root);
  if ("const" in schema) {
    return schema.const;
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum[0] ?? null;
  }
  for (const key of ["anyOf", "oneOf"] as const) {
    const options = schema[key];
    if (Array.isArray(options)) {
      const chosen =
        options.find((option) => asSchema(option)?.type !== "null") ??
        options[0];
      return sample(chosen, root, uuid, depth + 1);
    }
  }
  if (Array.isArray(schema.allOf)) {
    return sample(schema.allOf[0], root, uuid, depth + 1);
  }
  const type = Array.isArray(schema.type)
    ? (schema.type as unknown[]).find((candidate) => candidate !== "null")
    : schema.type;
  if (type === "object" || asSchema(schema.properties) !== null) {
    const properties = asSchema(schema.properties) ?? {};
    return Object.fromEntries(
      Object.entries(properties).map(([key, property]) => [
        key,
        sample(property, root, uuid, depth + 1),
      ]),
    );
  }
  if (type === "array") {
    const count = typeof schema.minItems === "number" ? schema.minItems : 0;
    const prefix = Array.isArray(schema.prefixItems) ? schema.prefixItems : [];
    const items = Array.from(
      { length: Math.max(count, prefix.length) },
      (_unused, index) =>
        sample(prefix[index] ?? schema.items, root, uuid, depth + 1),
    );
    return items;
  }
  if (type === "string") {
    return sampleString(schema, uuid);
  }
  if (type === "integer" || type === "number") {
    if (typeof schema.minimum === "number") {
      return Math.ceil(schema.minimum);
    }
    if (typeof schema.exclusiveMinimum === "number") {
      return Math.floor(schema.exclusiveMinimum) + 1;
    }
    return 0;
  }
  if (type === "boolean") {
    return false;
  }
  return null;
}

/**
 * The bodies tried on a route: the whole sample, its required fields alone, an empty object, and
 * each field alone with the required ones; none for a route without a body schema.
 */
export function bodiesOf(route: InventoriedRoute, uuid: string): unknown[] {
  const root = jsonSchemaOf(route.schema.body);
  if (root === null) {
    return [undefined];
  }
  const whole = sample(root, root, uuid);
  if (typeof whole !== "object" || whole === null || Array.isArray(whole)) {
    return [whole, {}];
  }
  const object = resolved(root, root);
  const required = new Set(
    Array.isArray(object.required) ? (object.required as string[]) : [],
  );
  const entries = Object.entries(whole);
  const base = Object.fromEntries(entries.filter(([key]) => required.has(key)));
  const bodies: unknown[] = [whole, base, {}];
  for (const [key, field] of entries) {
    if (!required.has(key)) {
      bodies.push({ ...base, [key]: field });
    }
  }
  const seen = new Set<string>();
  return bodies.filter((body) => {
    const text = JSON.stringify(body);
    return seen.has(text) ? false : (seen.add(text), true);
  });
}

export function queryOf(route: InventoriedRoute, uuid: string): string {
  const root = jsonSchemaOf(route.schema.querystring);
  if (root === null) {
    return "";
  }
  const values = sample(root, root, uuid);
  if (typeof values !== "object" || values === null) {
    return "";
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && typeof value !== "object") {
      query.set(key, String(value));
    }
  }
  const text = query.toString();
  return text === "" ? "" : `?${text}`;
}

export type SweepRequest = { method: Method; url: string; body: unknown };

/**
 * The requests of one route: each identifier of the path takes each of `ids` (the other party's
 * among them), the first one with every body, the others with the whole sample.
 */
export function requestsOf(
  route: InventoriedRoute,
  ids: readonly string[],
): SweepRequest[] {
  const method = route.method as Method;
  const hasParameter = /:[A-Za-z]+/.test(route.url);
  const values = hasParameter ? ids : [randomUUID()];
  const requests: SweepRequest[] = [];
  values.forEach((id, index) => {
    const url = `${route.url.replace(/:[A-Za-z]+/g, encodeURIComponent(id))}${queryOf(route, id)}`;
    const bodies = bodiesOf(route, id);
    for (const body of index === 0 ? bodies : bodies.slice(0, 1)) {
      requests.push({ method, url, body });
    }
  });
  return requests;
}
