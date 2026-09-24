import { remarkHeading } from "fumadocs-core/mdx-plugins";
import { remark } from "remark";
import { visitParents } from "unist-util-visit-parents";
import { describe, expect, it } from "vite-plus/test";

const docsDirectory = "../../../../internal-dashboard/content/docs/";

const wikiFiles: Readonly<Record<string, string>> = import.meta.glob(
  "../../../../internal-dashboard/content/docs/**/*.md",
  { eager: true, import: "default", query: "?raw" },
);

const parser = remark().use(remarkHeading);

function readPage(markdown: string) {
  const tree = parser.runSync(parser.parse(markdown));
  const anchors = new Set<string>();
  const links: string[] = [];
  visitParents(tree, (node) => {
    if (node.type === "heading") {
      const id = node.data?.hProperties?.["id"];
      if (typeof id === "string") {
        anchors.add(id);
      }
    }
    if (node.type === "link" && node.url.startsWith("/")) {
      links.push(node.url);
    }
  });
  return { anchors, links };
}

function pagePath(file: string) {
  const slug = file.slice(docsDirectory.length).replace(/(?:^|\/)index\.md$|\.md$/u, "");
  return `/${slug}`;
}

const pages = new Map(
  Object.entries(wikiFiles).map(([file, markdown]) => [pagePath(file), readPage(markdown)]),
);

const links = [...pages].flatMap(([page, { links: hrefs }]) =>
  hrefs.map((href) => ({ href, page })),
);

describe("links between wiki pages", () => {
  it("are collected from the wiki pages", () => {
    expect(links.length).toBeGreaterThan(0);
  });

  it.each(links)("$href in $page points at an existing page and heading", ({ href }) => {
    const [path = "", anchor] = href.split("#");
    const target = pages.get(path.replace(/\/$/u, "") || "/");
    expect(target).toBeDefined();
    if (anchor !== undefined) {
      expect(target?.anchors).toContain(decodeURIComponent(anchor));
    }
  });
});
