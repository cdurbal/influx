// Field names declared by a zod schema, at any depth, and the list of names a contract served to
// a brand must never declare (18 TM11.1, TM11.2; 07 RG18). Support of tm11-identifying-fields.test.ts.
// The walk reads zod's own definition and follows every wrapper, so that a field hidden in an
// array, a union, a lazy schema or a pipe is found as well; it never parses a value.
import type * as z from "zod";
import {
  creatorIdentityColumns,
  verificationColumns,
} from "../src/db/schema/introspection.ts";

type ZodDefinition = {
  type: string;
  shape?: Record<string, z.ZodType>;
  catchall?: z.ZodType;
  element?: z.ZodType;
  innerType?: z.ZodType;
  options?: readonly z.ZodType[];
  left?: z.ZodType;
  right?: z.ZodType;
  items?: readonly z.ZodType[];
  rest?: z.ZodType | null;
  in?: z.ZodType;
  out?: z.ZodType;
  keyType?: z.ZodType;
  valueType?: z.ZodType;
  getter?: () => z.ZodType;
};

export type FieldFound = { path: string; name: string };

/** True for a zod schema (a value carrying zod's internals), false for any other export. */
export function isZodSchema(value: unknown): value is z.ZodType {
  return (
    typeof value === "object" &&
    value !== null &&
    "_zod" in value &&
    typeof (value as { _zod: unknown })._zod === "object"
  );
}

/** Every object key declared by a schema, with its path from the root; each schema is walked once. */
export function declaredFields(
  schema: z.ZodType,
  root = "",
  seen: Set<z.ZodType> = new Set(),
): FieldFound[] {
  if (seen.has(schema)) {
    return [];
  }
  seen.add(schema);
  const definition = schema._zod.def as unknown as ZodDefinition;
  const children: (z.ZodType | null | undefined)[] = [
    definition.innerType,
    definition.element,
    definition.catchall,
    definition.left,
    definition.right,
    definition.in,
    definition.out,
    definition.keyType,
    definition.valueType,
    definition.rest,
    ...(definition.options ?? []),
    ...(definition.items ?? []),
  ];
  if (definition.type === "lazy") {
    children.push(definition.getter?.());
  }
  const found: FieldFound[] = [];
  for (const [name, child] of Object.entries(definition.shape ?? {})) {
    found.push({ path: `${root}.${name}`, name });
    found.push(...declaredFields(child, `${root}.${name}`, seen));
  }
  for (const child of children) {
    if (child !== null && child !== undefined) {
      found.push(...declaredFields(child, root, seen));
    }
  }
  return found;
}

/** A name compared without its case or separators: `legal_first_name` is `legalFirstName`. */
export function normalisedName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/**
 * Normalised names of every column of the identifying objects of 0217, read from their Drizzle
 * declaration (the SQL stays the source of truth; db-tests/profiles-creator-identity keeps the two
 * aligned): creator_identities, creator_social_accounts, the exact audience, the refused sectors
 * and the metric history. Nothing is written by hand: a column added to one of them joins the list.
 */
export function derivedColumnNames(): Map<string, string> {
  const names = new Map<string, string>();
  for (const [tableName, columns] of Object.entries(creatorIdentityColumns())) {
    for (const column of columns) {
      names.set(normalisedName(column), `${tableName}.${column}`);
    }
  }
  return names;
}

/**
 * Columns of those tables that identify nobody: keys, timestamps and codes that any contract of
 * the product has a reason to carry (the member's account, a network code, a country). Each is
 * checked to exist in the derived list, so the exemption cannot outlive its column.
 */
export const STRUCTURAL_COLUMNS: readonly string[] = [
  "account_id",
  "id",
  "created_at",
  "updated_at",
  "country_code",
];

/**
 * Names the list of matching-spec A3 forbids in an answer served to a brand, beyond the columns
 * above (07 RG18): the handle and its synonyms, the URL of a profile, the real name, the company
 * name, the contact details, the address, the exact figures, the price, the proofs, the photo, the
 * birth date, the brands already worked with. Compared by whole normalised name.
 */
export const RG18_NAMES: readonly string[] = [
  "pseudo",
  "pseudonym",
  "handle",
  "username",
  "screenName",
  "profileUrl",
  "postUrl",
  "firstName",
  "lastName",
  "legalFirstName",
  "legalLastName",
  "realName",
  "companyName",
  "legalName",
  "companyRegistrationNumber",
  "email",
  "contactEmail",
  "phone",
  "contactPhone",
  "phoneNumber",
  "address",
  "addressLine",
  "city",
  "postalCode",
  "zipCode",
  "followersCount",
  "followers",
  "engagementRate",
  "engagementRateBp",
  "rate",
  "price",
  "fee",
  "screenshot",
  "screenshots",
  "avatar",
  "avatarUrl",
  "photo",
  "photoUrl",
  "profilePicture",
  "dateOfBirth",
  "birthDate",
  "birthday",
  "pastBrands",
  "brandsWorkedWith",
  "proofs",
];

/** The forbidden names, normalised, each with where it comes from. */
export function forbiddenNames(): Map<string, string> {
  const derived = derivedColumnNames();
  const structural = new Set(STRUCTURAL_COLUMNS.map(normalisedName));
  const forbidden = new Map<string, string>();
  for (const [name, origin] of derived) {
    if (!structural.has(name)) {
      forbidden.set(name, origin);
    }
  }
  for (const name of RG18_NAMES) {
    const key = normalisedName(name);
    if (!forbidden.has(key)) {
      forbidden.set(key, "07 RG18");
    }
  }
  return forbidden;
}

/**
 * The fields of a schema whose name is forbidden, as `path (origin)`; none when it is clean. The
 * names in `allowed` are the member's own contact details, listed by the caller (see the test).
 */
export function forbiddenFieldsOf(
  schema: z.ZodType,
  allowed: readonly string[] = [],
  forbidden: ReadonlyMap<string, string> = forbiddenNames(),
): string[] {
  const allowedNames = new Set(allowed.map(normalisedName));
  return declaredFields(schema).flatMap(({ path, name }) => {
    const key = normalisedName(name);
    const origin = forbidden.get(key);
    return origin === undefined || allowedNames.has(key)
      ? []
      : [`${path} (${origin})`];
  });
}

/**
 * Normalised names of every column of the schema `verification` and of the brand's internal block,
 * read from their Drizzle declaration (src/db/schema/verification.ts, aligned by hand on 0221 to
 * 0227): 18 TM11 as L2E commit 17 extends it. A column added there joins the list by itself.
 */
export function derivedVerificationColumnNames(): Map<string, string> {
  const names = new Map<string, string>();
  for (const [tableName, columns] of Object.entries(verificationColumns())) {
    for (const column of columns) {
      names.set(normalisedName(column), `verification ${tableName}.${column}`);
    }
  }
  return names;
}

/**
 * Columns of `verification.*` whose NAME identifies nothing and that other contracts already carry
 * for their own object (an error code, a logo's width, a brand refusal's message, a status): the
 * value-level proof that no code, piece or finding leaks is T1 (markers) and T9.6. Each is checked
 * to exist in the derived list, so the exemption cannot outlive its column.
 */
export const VERIFICATION_GENERIC_COLUMNS: readonly string[] = [
  ...STRUCTURAL_COLUMNS,
  "byte_size",
  "code",
  "decided_at",
  "expires_at",
  "height",
  "is_active",
  "kind",
  "level",
  "member_message",
  "name",
  "network_code",
  // 0232: the outcome of a contest's reason, as the auth and account answers carry their own
  "outcome",
  "position",
  // 0231: a reason code of a withdrawal, as the refusal of a brand profile carries its own
  "reason_code",
  "request_id",
  "state",
  "status",
  "submitted_at",
  "url",
  "width",
];

/** The names of `verification.*` no schema outside the verification modules may declare. */
export function forbiddenVerificationNames(): Map<string, string> {
  const generic = new Set(VERIFICATION_GENERIC_COLUMNS.map(normalisedName));
  const forbidden = new Map<string, string>();
  for (const [name, origin] of derivedVerificationColumnNames()) {
    if (!generic.has(name)) {
      forbidden.set(name, origin);
    }
  }
  return forbidden;
}

/** True when the schema declares a field of that name, at any depth. */
export function declaresField(schema: z.ZodType, name: string): boolean {
  const key = normalisedName(name);
  return declaredFields(schema).some(
    (field) => normalisedName(field.name) === key,
  );
}
