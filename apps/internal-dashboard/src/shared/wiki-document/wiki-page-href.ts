import { wikiBasePath } from "@repo/config";

function wikiPageHref(path: string): string {
  const slug = path.replace(/(?:^|\/)index\.md$|\.md$/u, "");
  return slug === "" ? wikiBasePath : `${wikiBasePath}/${slug}`;
}

export { wikiPageHref };
