// SQL of the anonymous profile a brand opens and of its visuals (0323; jalons/l3f/modele.md §2, §3). The
// statements run in the member's transaction, as influx_advertiser, which holds NOTHING on `profiles.*`
// nor `search.*` but EXECUTE on the doors: they call search.open_creator_profile() and
// search.read_creator_visual() and read what they return, never a table.
// - The profile's door checks the caller (42501 `forbidden`), the brand's profile (RG1), the switch
//   (D38), the bucket of the account, the alias against THE engine (P0002 `creator`, CA49), and writes
//   the opening and the impression of origin in the same transaction (CA48): apps/api refuses AFTER
//   the COMMIT.
// - The visual's door returns the object of an APPROVED visual of a creator the engine lists for the
//   caller, or no row; the key stays in apps/api, which reads the bytes (D82 (7)).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";

/** search.open_creator_profile(alias): the JSON answer of the door, as it is. */
export async function callCreatorProfileDoor(
  tx: Transaction,
  alias: string,
): Promise<unknown> {
  const rows = await tx.execute<{ answer: unknown }>(
    sql`select search.open_creator_profile(${alias}::text) as answer`,
  );
  return rows[0]?.answer ?? null;
}

/** The object of a visual the door lets apps/api read: never served, never logged. */
export type CreatorVisualObject = {
  objectKey: string;
  width: number;
  height: number;
};

/** search.read_creator_visual(alias, visual): its object, or null when the door returns no row. */
export async function callCreatorVisualDoor(
  tx: Transaction,
  alias: string,
  visualId: string,
): Promise<CreatorVisualObject | null> {
  const rows = await tx.execute<{
    object_key: string;
    width: number;
    height: number;
  }>(
    sql`select v.object_key, v.width, v.height
          from search.read_creator_visual(${alias}::text, ${visualId}::uuid) v`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : { objectKey: row.object_key, width: row.width, height: row.height };
}
