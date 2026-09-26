// Column types that drizzle-orm 0.45 does not ship (docs/mvp/21 §4, J2 point 3).
import { customType } from "drizzle-orm/pg-core";

/** `bytea`: SHA-256 hashes (session tokens, terms versions, audit chain). */
export const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});
