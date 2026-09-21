// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { fileURLToPath } from "node:url";

import { assert, it } from "@effect/vitest";
import { applications } from "@repo/config";
import { Effect } from "effect";

import { monitorStacks } from "./monitors.ts";

const workflow = fileURLToPath(new URL("../../../.github/workflows/deploy.yml", import.meta.url));
const viteConfig = fileURLToPath(new URL("../vite.config.ts", import.meta.url));
const stackBuilds = [...applications, ...monitorStacks].map((unit) => `@repo/${unit}#build`);

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
    assert.include(source, "TEMPLATE_APP_DOMAIN");
    assert.include(source, "TEMPLATE_SERVICE_MEMBER_ORIGIN");
    assert.include(source, "TEMPLATE_SERVICE_ADMIN_ORIGIN");
    assert.include(source, "TEMPLATE_INTERNAL_DASHBOARD_ORIGIN");
  }),
);

it.effect("deploy and preview tasks refuse to run without every stack build", () =>
  Effect.gen(function* program() {
    const source = yield* Effect.promise(async () => readFile(viteConfig, "utf-8"));
    assert.include(
      source,
      "const stackBuilds = [...applications, ...monitorStacks].map((unit) => `@repo/${unit}#build`);",
    );
    assert.deepStrictEqual(stackBuilds, [
      "@repo/service-member#build",
      "@repo/service-admin#build",
      "@repo/internal-dashboard#build",
      "@repo/budget-monitor#build",
      "@repo/error-monitor#build",
      "@repo/health-monitor#build",
    ]);
    assert.include(
      source,
      'dependsOn: [...stackBuilds, "prerelease", "typescript-template#prerelease"]',
    );
    assert.include(source, 'dependsOn: [...stackBuilds, "verify:account"]');
    assert.include(source, "dependsOn: stackBuilds");
  }),
);
