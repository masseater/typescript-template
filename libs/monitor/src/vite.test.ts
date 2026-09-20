import { assert, it } from "@effect/vitest";

import { monitorWorkerVite } from "./vite.ts";

it("packs each monitor from src/worker.ts and builds that artifact before merge", () => {
  const config = monitorWorkerVite();
  const build = config.run.tasks.build;
  assert.deepStrictEqual(config.pack.entry, { index: "src/worker.ts" });
  assert.deepStrictEqual(config.pack.outExtensions(), { js: ".js" });
  assert.deepStrictEqual(config.pack.deps.onlyBundle, ["effect", "@repo/monitor"]);
  if (typeof build === "string" || build === undefined) {
    assert.fail("the shared build task was replaced");
  }
  assert.strictEqual(build.command, "vp pack");
  assert.deepStrictEqual(config.run.tasks.premerge, {
    command: [],
    dependsOn: ["build"],
  });
});
