// Splits the authority of an http(s) URL ("[user@]host[:port]") like Go's
// url.Parse does for the core: the port, when present, is digits only, an
// IPv6 literal must be bracketed and closed. Pure; null when invalid.

export interface Authority {
  /** Host without brackets (IPv6) and without the port; may be empty. */
  hostname: string;
  /** host[:port] as written, without user info. */
  host: string;
  hasUserInfo: boolean;
}

export function parseAuthority(authority: string): Authority | null {
  const at = authority.lastIndexOf('@');
  const host = authority.slice(at + 1);
  let hostname: string;
  let rest: string;
  if (host.startsWith('[')) {
    const close = host.indexOf(']');
    if (close < 0) return null;
    hostname = host.slice(1, close);
    rest = host.slice(close + 1);
  } else {
    const colon = host.indexOf(':');
    hostname = colon < 0 ? host : host.slice(0, colon);
    rest = colon < 0 ? '' : host.slice(colon);
    if (hostname.includes('[') || hostname.includes(']')) return null;
  }
  if (rest !== '' && !/^:\d*$/.test(rest)) return null;
  return { hostname, host, hasUserInfo: at >= 0 };
}
