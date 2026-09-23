import { wikiBasePath } from "@repo/config";

function resolveWikiDocHref(href: string, baseUrl = wikiBasePath): string {
  if (
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("http:") ||
    href.startsWith("https:") ||
    href.startsWith("//") ||
    href === baseUrl ||
    href.startsWith(`${baseUrl}/`)
  ) {
    return href;
  }
  if (href.startsWith("/")) {
    return `${baseUrl}${href}`;
  }
  return href;
}

export { resolveWikiDocHref };
