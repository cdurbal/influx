// Website of a brand, kept as a domain only (docs/mvp/06 RG17, CA4, edge case 2). A protocol, a
// path, a parameter, an anchor, a port or credentials are dropped on saving: only the host stays,
// which is what lets D40 keep the site public without opening a contact route. A direct contact
// page belongs to the internal layer (RG35). No dependency and no `URL`: the rule is the same in the
// API and, later, in a front.

/** Longest domain kept (RG15). */
export const WEBSITE_DOMAIN_MAX_LENGTH = 100;

export type WebsiteDomainRefusal = "empty" | "invalid_host" | "too_long";

export type WebsiteDomainResult =
  | {
      readonly ok: true;
      /** The domain to store, lower case. */
      readonly domain: string;
      /** The typed value was more than a domain: the screen explains the reduction (CA4). */
      readonly reduced: boolean;
    }
  | { readonly ok: false; readonly reason: WebsiteDomainRefusal };

const SCHEME = /^([a-z][a-z0-9+.-]*):(\/\/)?/i;
const PORT_ONLY = /^\d{1,5}(?:[/?#]|$)/;
const LABEL = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u;
const CONTROL_OR_SPACE = /[\p{Cc}\s]/u;

/**
 * Reduces what a brand typed to a domain (RG17). Refuses a value that holds no valid host:
 * a single label, an IP address, a scheme without authority (`javascript:`, `mailto:`), a
 * character no host holds, a label over 63 characters, a domain over 100.
 */
export function normalizeWebsiteDomain(input: string): WebsiteDomainResult {
  const typed = input.trim();
  if (typed === "") return { ok: false, reason: "empty" };
  if (CONTROL_OR_SPACE.test(typed)) {
    return { ok: false, reason: "invalid_host" };
  }

  let rest = typed.normalize("NFC");
  const scheme = SCHEME.exec(rest);
  if (scheme !== null) {
    const afterColon = rest.slice(scheme[0].length);
    if (scheme[2] === undefined) {
      // `exemple.com:8080` reads as a scheme followed by a port; `javascript:alert(1)` and
      // `mailto:a@b.com` are a scheme without authority, which is no website.
      if (!PORT_ONLY.test(afterColon)) {
        return { ok: false, reason: "invalid_host" };
      }
    } else {
      rest = afterColon;
    }
  } else if (rest.startsWith("//")) {
    rest = rest.slice(2);
  }

  const authorityEnd = rest.search(/[/?#]/);
  let host = authorityEnd === -1 ? rest : rest.slice(0, authorityEnd);
  host = host.slice(host.lastIndexOf("@") + 1);
  host = host
    .replace(/:\d{1,5}$/, "")
    .replace(/\.$/, "")
    .toLowerCase();

  const labels = host.split(".");
  const tld = labels[labels.length - 1] ?? "";
  const valid =
    labels.length >= 2 &&
    labels.every((label) => label.length <= 63 && LABEL.test(label)) &&
    // a numeric last label is an IPv4 address, not a domain
    !/^\d+$/.test(tld) &&
    Array.from(tld).length >= 2;
  if (!valid) return { ok: false, reason: "invalid_host" };
  if (Array.from(host).length > WEBSITE_DOMAIN_MAX_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, domain: host, reduced: host !== typed };
}
