import { remark } from "remark";
import remarkGfm from "remark-gfm";

import type { Image, Nodes } from "mdast";

const editorImagePrefix = "/api/wiki-edit/images/";
const imageDirectory = "images";
const imageName = /^[0-9a-f]{64}\.(?:gif|jpg|png|webp)$/u;

type ImageLink = Readonly<{ end: number; name: string; start: number }>;

const imageNodes = (node: Nodes): readonly Image[] => {
  if (node.type === "image") return [node];
  if (!("children" in node)) return [];
  const children: readonly Nodes[] = node.children;
  return children.flatMap((child) => imageNodes(child));
};

const imageLinks = (markdown: string, prefix: string): readonly ImageLink[] =>
  imageNodes(remark().use(remarkGfm).parse(markdown)).flatMap((image) => {
    const name = image.url.startsWith(prefix) ? image.url.slice(prefix.length) : "";
    const nodeStart = image.position?.start.offset;
    const nodeEnd = image.position?.end.offset;
    if (!imageName.test(name) || nodeStart === undefined || nodeEnd === undefined) return [];
    const destination = markdown.slice(nodeStart, nodeEnd).lastIndexOf(`](${image.url}`);
    if (destination === -1) return [];
    const start = nodeStart + destination + "](".length;
    return [{ end: start + image.url.length, name, start }];
  });

const replacedImageLinks = (
  markdown: string,
  links: readonly ImageLink[],
  prefix: string,
): string =>
  links
    .toSorted((left, right) => right.start - left.start)
    .reduce(
      (rewritten, link) =>
        `${rewritten.slice(0, link.start)}${prefix}${link.name}${rewritten.slice(link.end)}`,
      markdown,
    );

function repositoryImagePrefix(pagePath: string): string {
  const depth = pagePath.split("/").length - 1;
  return depth === 0 ? `./${imageDirectory}/` : `${"../".repeat(depth)}${imageDirectory}/`;
}

function toRepositoryImages(
  markdown: string,
  pagePath: string,
): Readonly<{ images: readonly string[]; markdown: string }> {
  const links = imageLinks(markdown, editorImagePrefix);
  return {
    images: [...new Set(links.map((link) => link.name))],
    markdown: replacedImageLinks(markdown, links, repositoryImagePrefix(pagePath)),
  };
}

function toEditorImages(markdown: string, pagePath: string): string {
  return replacedImageLinks(
    markdown,
    imageLinks(markdown, repositoryImagePrefix(pagePath)),
    editorImagePrefix,
  );
}

export { editorImagePrefix, imageDirectory, toEditorImages, toRepositoryImages };
