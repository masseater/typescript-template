import { fileURLToPath } from "node:url";

import { assert, it } from "@effect/vitest";
import { applications } from "@repo/config";
import { deploymentKeys, optionalDeploymentKeys } from "@repo/observability/deployment-keys";
import { Effect, FileSystem } from "effect";

import { monitorStacks } from "./monitors.ts";
import { layer } from "./platform.ts";

const workflow = fileURLToPath(
  new URL("../../../../../.github/workflows/deploy.yml", import.meta.url),
);
const setupGuide = fileURLToPath(
  new URL(
    "../../../../../apps/internal-dashboard/content/docs/getting-started/first-steps.md",
    import.meta.url,
  ),
);
const viteConfig = fileURLToPath(new URL("../../../vite.config.ts", import.meta.url));
const stackBuilds = ["core", ...applications, ...monitorStacks].map(
  (unit) => `@repo/${unit}#build`,
);
const documentedSecrets = [...deploymentKeys, ...optionalDeploymentKeys];

function readText(file: string): Effect.Effect<string> {
  return Effect.gen(function* readFile() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* filesystem.readFileString(file);
  }).pipe(Effect.orDie, Effect.provide(layer));
}

it.effect("deploy workflow sends main to staging and promote to production", () =>
  Effect.gen(function* program() {
    const source = yield* readText(workflow);
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
    for (const key of documentedSecrets) {
      assert.include(source, key);
    }
  }),
);

it.effect("getting started names every deployment secret", () =>
  Effect.gen(function* program() {
    const guide = yield* readText(setupGuide);
    for (const key of documentedSecrets) {
      assert.include(guide, key);
    }
  }),
);

it.effect("deploy and preview tasks refuse to run without every stack build", () =>
  Effect.gen(function* program() {
    const source = yield* readText(viteConfig);
    assert.include(source, 'const stackBuilds = ["core", ...applications, ...monitorStacks].map(');
    assert.deepStrictEqual(stackBuilds, [
      "@repo/core#build",
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
