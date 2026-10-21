// The only import of zod in this package: every schema module takes `z` from here, so that the
// setting below is in force before the first schema is built (zod reads it at construction).
// In a browser, zod probes `new Function("")` to compile its object parsers; the CSP of the
// fronts refuses `eval` (03 §6.5) and the browser reports the caught probe as a violation
// (18 T10.6). `jitless` skips the probe there; servers keep the compiled parsers.
import * as z from "zod";

if ("window" in globalThis) {
  z.config({ jitless: true });
}

export { z };
