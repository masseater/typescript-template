// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import path from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { repositoryRoot } from "./repository-root.ts";

describe("repositoryRoot", () => {
  const it = test.extend("opensWithWorkspaceKey", async () =>
    (await readFile(path.join(repositoryRoot, "pnpm-workspace.yaml"), "utf-8")).startsWith(
      "packages:\n",
    ));

  it("is the directory that holds the workspace manifest", ({ opensWithWorkspaceKey }) => {
    expect(opensWithWorkspaceKey).toBe(true);
  });
});
