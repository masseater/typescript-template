const WIKI_DOCS_BASE_URL = "/wiki";

function resolveWikiDocHref(href: string, baseUrl = WIKI_DOCS_BASE_URL): string {
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

export { WIKI_DOCS_BASE_URL, resolveWikiDocHref };
