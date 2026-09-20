// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

const workflow = fileURLToPath(new URL("../../../.github/workflows/deploy.yml", import.meta.url));

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
  }),
);
