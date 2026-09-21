import { locales } from "#shared/i18n/index.ts";

const localePrefix = `(?:\\/(?:${locales.join("|")}))?`;
const identifiableSegment = new RegExp(
  `^(${localePrefix}\\/(?:users|messages|board|groups|support))\\/[^/?#]+`,
  "u",
);

function sanitizeAnalyticsPath(pathname: string): string {
  return pathname.replace(identifiableSegment, "$1/_");
}

export { identifiableSegment, sanitizeAnalyticsPath };
