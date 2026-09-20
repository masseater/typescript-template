// oxlint-disable-next-line import/no-nodejs-modules
import { readFileSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { repositoryRoot } from "@repo/config/repository-root";
import { describe, expect, it } from "vite-plus/test";

import { appRun } from "./vite.ts";

const devStartSource = readFileSync(
  path.join(repositoryRoot, "tools/dev/src/dev-start.ts"),
  "utf8",
);
const viteSource = readFileSync(new URL("./vite.ts", import.meta.url), "utf8");

describe("check:dev local D1", () => {
  it("does not share the workspace migrate before starting each app", () => {
    expect.hasAssertions();
    const task = appRun.tasks["check:dev"];
    expect(task).toEqual(
      expect.objectContaining({
        command: "node ../../tools/dev/src/dev-start.ts",
        dependsOn: ["@repo/dev#setup"],
      }),
    );
  });

  it("isolates each start behind a temporary local database", () => {
    expect.hasAssertions();
    expect(devStartSource).toMatch(/localDatabaseVariable/u);
    expect(devStartSource).toMatch(/mkdtemp/u);
    expect(devStartSource).toMatch(/db:migrate:local/u);
    expect(viteSource).toMatch(/persistState: \{ path: localDatabaseDirectory\(\) \}/u);
  });
});
