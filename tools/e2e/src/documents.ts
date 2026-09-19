import { readdir } from "node:fs/promises";
import path from "node:path";

import { applicationRoot } from "./repository.ts";

import type { Application } from "@repo/config";

const markdown = /\.mdx?$/u;
const minimumPages = 2;

const documentPaths = async (application: Application): Promise<readonly string[]> => {
  const root = path.join(applicationRoot(application), "content", "docs");
  const found = await readdir(root, { recursive: true, withFileTypes: true });
  const paths = found
    .filter((candidate) => candidate.isFile() && markdown.test(candidate.name))
    .map((document) => path.relative(root, path.join(document.parentPath, document.name)))
    .map((file) => `/wiki/${file.replace(markdown, "").replace(/\/index$/u, "")}`)
    .toSorted();
  if (paths.length < minimumPages) {
    throw new Error("E2E_NOT_ENOUGH_DOCUMENT_PAGES");
  }
  return paths;
};

export { documentPaths };
