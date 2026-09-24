import { describe, expect, it } from "vite-plus/test";

import {
  editorImagePrefix,
  imageDirectory,
  toEditorImages,
  toRepositoryImages,
} from "./wiki-image-paths.ts";

const image = `${"a1".repeat(32)}.png`;
const other = `${"b2".repeat(32)}.webp`;
const draft = `---\ntitle: 画像\ndescription: 画像の例\n---\n\n![図](${editorImagePrefix}${image})\n\n![写真](${editorImagePrefix}${other} "題")\n\n![図](${editorImagePrefix}${image})\n\n[外部](https://example.test/a.png)\n`;
const docsRoot = "https://docs.example.test/docs/";

describe.each(["index.md", "getting-started/first-steps.md", "plans/wiki/editing.md"])(
  "an image in %s",
  (pagePath) => {
    const published = toRepositoryImages(draft, pagePath);
    const linked = [...published.markdown.matchAll(/\]\((?<href>[^\s)]+)/gu)].map(
      (match) => new URL(match.groups?.["href"] ?? "", new URL(pagePath, docsRoot)).href,
    );

    it("links every uploaded image to the shared images directory beside the documents", () => {
      expect(linked).toStrictEqual([
        `${docsRoot}${imageDirectory}/${image}`,
        `${docsRoot}${imageDirectory}/${other}`,
        `${docsRoot}${imageDirectory}/${image}`,
        "https://example.test/a.png",
      ]);
    });

    it("names each image once for the commit", () => {
      expect(published.images).toStrictEqual([image, other]);
    });

    it("comes back to the editor as the uploaded address", () => {
      expect(toEditorImages(published.markdown, pagePath)).toBe(draft);
    });
  },
);
