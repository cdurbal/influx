// The ONLY route file of this front: the relay to apps/api (docs/mvp/02-architecture-3-espaces.md
// §9.3, docs/mvp/21-plan-de-developpement.md §4 J1-C and J1-G). Byte-for-byte identical in
// apps/web and apps/backoffice, SHA-256 pinned in @influx/test-kit (03 PP-12). The one named copy of
// arbitration PL-07: Next.js reads runtime, dynamic and revalidate as literals of this very file.
import { relay } from "@influx/web-platform/relay";

// 03 PP-11: never cached, rendered at each request, on Node.js.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// 03 PP-3: these five methods only.
export const GET = relay;
export const POST = relay;
export const PATCH = relay;
export const PUT = relay;
export const DELETE = relay;
