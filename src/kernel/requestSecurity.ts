export interface LocalBrowserRequest {
  origin?: string;
  host?: string;
  remoteAddress?: string;
  secFetchSite?: string;
}

function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  const normalized = address.toLowerCase().replace(/^::ffff:/, '');
  return normalized === '::1' || normalized.startsWith('127.');
}

export function isSameOriginLoopbackRequest(request: LocalBrowserRequest): boolean {
  const { origin, host, remoteAddress, secFetchSite } = request;
  if (!origin || !host || !isLoopbackAddress(remoteAddress)) return false;
  try {
    const originUrl = new URL(origin);
    const hostname = originUrl.hostname.toLowerCase();
    return originUrl.host === host &&
      (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') &&
      secFetchSite === 'same-origin';
  } catch {
    return false;
  }
}
