import { repositoryRoot } from "@repo/config/repository-root";
import { describe, expect, it } from "vite-plus/test";

import { appRun } from "./vite.ts";

const nodeFs = process.getBuiltinModule("fs") as {
  readonly readFileSync: (location: string, encoding: string) => string;
};
const nodePath = process.getBuiltinModule("path") as {
  readonly dirname: (location: string) => string;
  readonly join: (...parts: readonly string[]) => string;
};
const nodeUrl = process.getBuiltinModule("url") as {
  readonly fileURLToPath: (location: URL) => string;
};

const readText = (location: string): string => nodeFs.readFileSync(location, "utf8");

const here = nodePath.dirname(nodeUrl.fileURLToPath(new URL(import.meta.url)));
const devStartSource = readText(nodePath.join(repositoryRoot, "tools/dev/src/dev-start.ts"));
const viteSource = readText(nodePath.join(here, "vite.ts"));

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
    expect(viteSource).toMatch(/persistState: \{ path: localDatabaseDirectory\(\) \}/u);
  });
});
