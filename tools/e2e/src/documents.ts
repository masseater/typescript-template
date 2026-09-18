// oxlint-disable-next-line import/no-nodejs-modules
import { readdir } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import type { Application } from "@repo/config";

import { applicationRoot } from "./repository.ts";

const markdown = /\.mdx?$/u;
const minimumPages = 2;

async function documentPaths(application: Application): Promise<readonly string[]> {
  const root = path.join(applicationRoot(application), "content", "docs");
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const paths = entries
    .filter((entry) => entry.isFile() && markdown.test(entry.name))
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
    .map((file) => `/${file.replace(markdown, "")}`)
    .toSorted();
  if (paths.length < minimumPages) {
    throw new Error("E2E_NOT_ENOUGH_DOCUMENT_PAGES");
  }
  return paths;
}

export { documentPaths };
