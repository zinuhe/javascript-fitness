/**
 * Where a request came from, for the activity log: "iPhone" (Safari or the installed app),
 * "iPad", "Android", or "Web · Mac" / "Web · Windows" / "Web · Linux" / "Web".
 */
export function deviceFrom(userAgent: string | undefined): string {
  const ua = userAgent ?? '';
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Web · Mac';
  if (/Windows/.test(ua)) return 'Web · Windows';
  if (/Linux/.test(ua)) return 'Web · Linux';
  return 'Web';
}
