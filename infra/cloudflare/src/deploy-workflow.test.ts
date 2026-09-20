// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { assert, it } from "@effect/vitest";
import { budgetKeys, deploymentKeys, optionalDeploymentKeys } from "@repo/config/deployment-keys";
import { Effect } from "effect";

const workflow = fileURLToPath(new URL("../../../.github/workflows/deploy.yml", import.meta.url));
const setupGuide = fileURLToPath(
  new URL(
    "../../../apps/internal-dashboard/content/docs/getting-started/first-steps.md",
    import.meta.url,
  ),
);

it.effect("deploy workflow sends main to staging and promote to production", () =>
  Effect.gen(function* program() {
    const source = yield* Effect.promise(async () => readFile(workflow, "utf-8"));
    assert.include(source, "environment: staging");
    assert.include(source, "environment: production");
    assert.include(source, "branches: [main]");
    assert.include(source, "workflow_dispatch:");
    assert.include(source, "options: [staging, production]");
    assert.include(source, "deploy:ordered");
    assert.include(source, "probe:origins");
    assert.include(source, "prepare:ci-env");
    assert.include(source, "steps.prepare.outputs.configured == 'true'");
    assert.include(source, "ref: main");
    const documented = [
      ...deploymentKeys,
      ...optionalDeploymentKeys,
      ...budgetKeys.filter((key) => !deploymentKeys.some((required) => required === key)),
    ];
    for (const key of documented) {
      assert.include(source, key);
    }
  }),
);

it.effect("getting started names every deployment secret", () =>
  Effect.gen(function* program() {
    const guide = yield* Effect.promise(async () => readFile(setupGuide, "utf-8"));
    const documented = [
      ...deploymentKeys,
      ...optionalDeploymentKeys,
      ...budgetKeys.filter((key) => !deploymentKeys.some((required) => required === key)),
    ];
    for (const key of documented) {
      assert.include(guide, key);
    }
  }),
);
