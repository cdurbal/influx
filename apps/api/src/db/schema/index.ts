// Drizzle declaration of the Lot 0 tables (docs/mvp/21 §4, J2 point 3): one pgSchema() per
// Postgres schema. The SQL of supabase/migrations is the source of truth; this declaration is
// aligned by hand, never generated (drizzle-kit is not installed, 21 J1-A).
export * as auditSchema from "./audit.ts";
export * as backofficeSchema from "./backoffice.ts";
export * as billingSchema from "./billing.ts";
export * as identitySchema from "./identity.ts";
export * as profilesSchema from "./profiles.ts";
export * as referenceSchema from "./reference.ts";
