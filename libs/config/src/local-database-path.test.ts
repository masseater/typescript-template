// oxlint-disable-next-line import/no-nodejs-modules
import { readFileSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdtemp, rm } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { localDatabaseDirectory, localDatabaseVariable } from "./local-database-path.ts";
import { appRun } from "./vite.ts";

const devStartSource = readFileSync(new URL("./dev-start.ts", import.meta.url), "utf8");
const viteSource = readFileSync(new URL("./vite.ts", import.meta.url), "utf8");

describe("check:dev local D1", () => {
  it("does not share the workspace migrate before starting each app", () => {
    expect.hasAssertions();
    const task = appRun.tasks["check:dev"];
    expect(task).toEqual(
      expect.objectContaining({
        command: "dev-start",
        dependsOn: ["@repo/dev#setup"],
      }),
    );
  });

  it("reads the persist directory from the environment at call time", async () => {
    expect.hasAssertions();
    const directory = await mkdtemp(path.join(tmpdir(), "template-local-database-path-"));
    // oxlint-disable-next-line node/no-process-env
    const previous = process.env[localDatabaseVariable];
    try {
      // oxlint-disable-next-line node/no-process-env
      process.env[localDatabaseVariable] = directory;
      expect(localDatabaseDirectory()).toBe(path.resolve(directory));
    } finally {
      if (previous === undefined) {
        // oxlint-disable-next-line node/no-process-env
        delete process.env[localDatabaseVariable];
      } else {
        // oxlint-disable-next-line node/no-process-env
        process.env[localDatabaseVariable] = previous;
      }
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("isolates each start behind a temporary local database", () => {
    expect.hasAssertions();
    expect(devStartSource).toMatch(/localDatabaseVariable/u);
    expect(devStartSource).toMatch(/mkdtemp/u);
    expect(devStartSource).toMatch(/db:migrate:local/u);
    expect(viteSource).toMatch(/persistState: \{ path: localDatabaseDirectory\(\) \}/u);
  });
});
