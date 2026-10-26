// EC-22 (docs/mvp/02-architecture-3-espaces.md §20.9, §20.10): the public health route of web, the
// one an outside probe would call one day without a line of code. 200 or 503, EMPTY body, no
// detail: it asks apps/api for GET /v1/status through the relay, with the caller's address only
// (its own rate, 18 T15). Outside the matcher of the proxy (no locale, no page CSP); never cached.
import { relay } from "../../server/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_PATH = "/api/v1/status";
const CLIENT_ADDRESS_HEADER = "x-real-ip";

export async function GET(request: Request): Promise<Response> {
  const headers = new Headers();
  const address = request.headers.get(CLIENT_ADDRESS_HEADER);
  if (address !== null) {
    headers.set(CLIENT_ADDRESS_HEADER, address);
  }
  const status = await relay(
    new Request(new URL(STATUS_PATH, request.url), { method: "GET", headers }),
  );
  await status.body?.cancel();
  return new Response(null, {
    status: status.status === 200 ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
