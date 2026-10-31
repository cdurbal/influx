// EC-22 (docs/mvp/02-architecture-3-espaces.md §20.9, §20.10): the public health route of web, the
// one an outside probe would call one day without a line of code. 200 or 503, EMPTY body, no
// detail: it asks apps/api for GET /v1/status through the relay, with the caller's address only
// (its own rate, 18 T15). Outside the matcher of the proxy (no locale, no page CSP); never cached
// by the browser or a CDN. J9S-6: the answer of apps/api is kept 5 s in the memory of the process
// (success and failure), so that a flood does not drain the instance bucket of /v1/status.
import { relay } from "@influx/web-platform/relay";
import { createStatusCache } from "../../server/status-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_PATH = "/api/v1/status";
const CLIENT_ADDRESS_HEADER = "x-real-ip";
const STATUS_TTL_MS = 5_000;

const cachedStatus = createStatusCache(STATUS_TTL_MS);

export async function GET(request: Request): Promise<Response> {
  const headers = new Headers();
  const address = request.headers.get(CLIENT_ADDRESS_HEADER);
  if (address !== null) {
    headers.set(CLIENT_ADDRESS_HEADER, address);
  }
  const healthy = await cachedStatus(async () => {
    const status = await relay(
      new Request(new URL(STATUS_PATH, request.url), {
        method: "GET",
        headers,
      }),
    );
    await status.body?.cancel();
    return status.status === 200;
  });
  return new Response(null, {
    status: healthy ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
