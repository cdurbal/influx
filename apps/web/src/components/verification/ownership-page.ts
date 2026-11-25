// Server side of the ownership journey page (docs/mvp/08 §C; jalons/l2e/modele.md §6, commit 18): the
// network of the line arrives as the `network` of the query (never as a segment of the path, J4S-7)
// and is read here, once, as a code of the reference list or a 404. The screen then asks the API what
// the creator holds on it: a network he has no line on is "no such line" there too (T14).
import { notFound } from "next/navigation";
import { isNetworkCode, NETWORK_QUERY_PARAMETER } from "@/lib/member-paths";

/** The network of the journey, from the query of the page; anything that is not a network code is a 404. */
export function ownershipNetworkOf(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const value = searchParams[NETWORK_QUERY_PARAMETER];
  if (typeof value !== "string" || !isNetworkCode(value)) {
    notFound();
  }
  return value;
}
