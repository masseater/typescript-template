import { assert, it } from "@effect/vitest";

import { monitorWorkerVite } from "./vite.ts";

it("packs each monitor from its feature worker and builds that artifact in the pull request gate", () => {
  const config = monitorWorkerVite("error-monitor");
  const build = config.run.tasks.build;
  assert.deepStrictEqual(config.pack.entry, { index: "src/features/error-monitor/worker.ts" });
  assert.deepStrictEqual(config.pack.outExtensions(), { js: ".js" });
  assert.deepStrictEqual(config.pack.deps.alwaysBundle, [/^@repo\//, /^effect(?:\/|$)/]);
  assert.deepStrictEqual(config.pack.deps.onlyBundle, ["effect", "@repo/monitor"]);
  if (typeof build === "string" || build === undefined) {
    assert.fail("the shared build task was replaced");
  }
  assert.strictEqual(build.command, "vp pack");
  assert.strictEqual(config.run.tasks["check:modular"]?.command, "quality-check-modular");
  assert.deepStrictEqual(config.run.tasks.prepr, {
    command: [],
    dependsOn: ["prepush", "build"],
  });
  assert.deepStrictEqual(config.run.tasks.premerge, { command: [], dependsOn: [] });
  assert.deepStrictEqual(config.run.tasks.prepush, {
    command: [],
    dependsOn: ["precommit", "check:effect", "check:modular"],
  });
});
