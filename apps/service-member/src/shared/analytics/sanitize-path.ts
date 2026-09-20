const identifiableSegment = /^(\/(?:users|messages|board|groups|support))\/[^/?#]+/u;

function sanitizeAnalyticsPath(pathname: string): string {
  return pathname.replace(identifiableSegment, "$1/_");
}

export { sanitizeAnalyticsPath };
