import { repositoryRoot } from "@repo/config/repository-root";
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { filesystem, paths } from "./host.ts";
import { appRun } from "./vite.ts";

const readText = (location: string): string =>
  Effect.runSync(Effect.orDie(filesystem.readFileString(location)));

const devStartSource = readText(paths.join(repositoryRoot, "tools/dev/src/dev-start.ts"));
const viteSource = readText(
  Effect.runSync(Effect.orDie(paths.fromFileUrl(new URL("./vite.ts", import.meta.url)))),
);

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
