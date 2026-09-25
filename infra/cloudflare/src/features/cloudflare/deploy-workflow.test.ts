import { assert, it } from "@effect/vitest";
import { applications, wikiWorker } from "@repo/config";
import { deploymentKeys, optionalDeploymentKeys } from "@repo/observability/deployment-keys";
import { Effect, FileSystem } from "effect";

import { monitorStacks } from "./monitors.ts";
import { fileUrlPath, layer } from "./platform.ts";

const workflow = fileUrlPath(
  new URL("../../../../../.github/workflows/deploy.yml", import.meta.url),
);
const environmentWorkflow = fileUrlPath(
  new URL("../../../../../.github/workflows/deploy-environment.yml", import.meta.url),
);
const setupGuide = fileUrlPath(
  new URL(
    "../../../../../apps/internal-dashboard/content/docs/getting-started/first-steps.md",
    import.meta.url,
  ),
);
const viteConfig = fileUrlPath(new URL("../../../vite.config.ts", import.meta.url));
const stackBuilds = ["core", wikiWorker, ...applications, ...monitorStacks].map(
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
    assert.include(source, "ref: main");
    assert.include(source, "uses: ./.github/workflows/deploy-environment.yml");
    assert.include(source, "secrets: inherit");
  }),
);

it.effect("each environment deploys with every secret and probes what it applied", () =>
  Effect.gen(function* program() {
    const source = yield* readText(environmentWorkflow);
    assert.include(source, "workflow_call:");
    assert.include(source, "environment: ${{ inputs.environment }}");
    assert.include(source, "deploy:ordered");
    assert.include(source, "probe:origins");
    assert.include(source, "prepare:ci-env");
    assert.include(source, "steps.prepare.outputs.configured == 'true'");
    for (const key of documentedSecrets) {
      assert.include(source, key);
    }
  }),
);

it.effect("a plan that removes resources waits for the approval job and then applies", () =>
  Effect.gen(function* program() {
    const caller = yield* readText(workflow);
    const callee = yield* readText(environmentWorkflow);
    for (const output of ["approval-stack", "approval-confirmation"]) {
      assert.include(callee, `steps.deploy.outputs.${output}`);
      assert.include(callee, `jobs.deploy.outputs.${output}`);
      assert.include(caller, `needs.staging.outputs.${output}`);
      assert.include(caller, `needs.production.outputs.${output}`);
    }
    assert.include(callee, 'deploy:ordered --approve "$APPROVAL_STACK" "$APPROVAL_CONFIRMATION"');
    assert.include(callee, "require:removal-approval");
    assert.include(callee, "commit: ${{ steps.checkout.outputs.commit }}");
    assert.include(caller, "ref: ${{ needs.staging.outputs.commit }}");
    assert.include(caller, "ref: ${{ needs.production.outputs.commit }}");
    assert.include(caller, "needs: [staging, staging-removal-approval]");
    assert.include(caller, "needs: [production, production-removal-approval]");
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
    assert.include(
      source,
      'const stackBuilds = ["core", wikiWorker, ...applications, ...monitorStacks].map(',
    );
    assert.deepStrictEqual(stackBuilds, [
      "@repo/core#build",
      "@repo/internal-wiki#build",
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
