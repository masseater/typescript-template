import { readFileSync } from "node:fs";
import path from "node:path";

import { repositoryRoot } from "@repo/config/repository-root";
import { describe, expect, it } from "vite-plus/test";

import { appRun } from "./vite.ts";

const devStartSource = readFileSync(
  path.join(repositoryRoot, "tools/dev/src/dev-start.ts"),
  "utf8",
);
const viteSource = readFileSync(new URL("./vite.ts", import.meta.url), "utf8");

describe("app build", () => {
  it("type-checks the workspace graph before Rolldown links named imports", () => {
    expect.hasAssertions();
    expect(appRun.tasks.build).toEqual(
      expect.objectContaining({
        command: "vp build",
        dependsOn: ["@repo/dev#setup", "check:effect"],
      }),
    );
  });
});

describe("check:dev local D1", () => {
  it("does not share the workspace migrate before starting each app", () => {
    expect.hasAssertions();
    const task = appRun.tasks["check:dev"];
    expect(task).toEqual(
      expect.objectContaining({
        command: "../../tools/dev/src/dev-start.ts",
        dependsOn: ["@repo/dev#setup"],
      }),
    );
  });

  it("isolates each start behind a temporary local database", () => {
    expect.hasAssertions();
    expect(devStartSource).toMatch(/localDatabaseVariable/u);
    expect(devStartSource).toMatch(/makeTempDirectory/u);
    expect(devStartSource).toMatch(/db:migrate:local/u);
    expect(devStartSource).toMatch(/failureBodyLimit/u);
    expect(viteSource).toMatch(/persistState: \{ path: localDatabaseDirectory\(\) \}/u);
  });

  it("hosts core as an auxiliary worker on the same local D1", () => {
    expect.hasAssertions();
    expect(viteSource).toMatch(/auxiliaryWorkers: \[coreDevWorker\]/u);
    expect(viteSource).toMatch(/binding: "CORE"/u);
    expect(viteSource).toMatch(/d1_databases: \[localDatabase\]/u);
    expect(viteSource).toMatch(/elysiaAot\(appRoot\)/u);
    expect(readFileSync(new URL("./elysia-aot.ts", import.meta.url), "utf8")).toMatch(
      /environment\.name === "ssr"/u,
    );
    expect(readFileSync(new URL("./elysia-aot.ts", import.meta.url), "utf8")).toMatch(
      /id === "elysia"/u,
    );
  });
});
