import { readFile } from "node:fs/promises";
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
