import { rm } from "node:fs/promises";

import { cruise, type ICruiseResult } from "dependency-cruiser";
import { describe, expect, it } from "vite-plus/test";

import { createFixture, type Fixture } from "./dependency-cruiser-fixture.ts";
import configuration from "./dependency-cruiser.ts";

type Case = readonly [string, Fixture];

const forbidden = configuration.forbidden ?? [];
const configuredRules = new Set<string>();
for (const rule of forbidden) {
  configuredRules.add(rule.name ?? "");
}

const reportedRules = (
  violations: readonly { readonly rule: { readonly name: string } }[],
): string[] => {
  const reported = new Set<string>();
  for (const violation of violations) {
    reported.add(violation.rule.name);
  }
  return [...reported].toSorted();
};

const cruiseModules = async (
  directories: readonly string[],
  baseDir?: string,
): Promise<ICruiseResult> => {
  const { output } = await cruise(
    [...directories],
    {
      ...configuration.options,
      ...(baseDir === undefined ? {} : { baseDir }),
      ruleSet: { forbidden },
      validate: true,
    },
    configuration.options?.enhancedResolveOptions,
  );
  if (typeof output === "string") {
    throw new TypeError(
      "dependency-cruiser reported a formatted string instead of a cruise result",
    );
  }
  return output;
};

const violatedRules = async (files: Fixture): Promise<readonly string[]> => {
  const root = await createFixture(files);
  try {
    const { summary } = await cruiseModules(["apps", "libs", "tools"], root);
    return reportedRules(summary.violations);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
};

const detected: readonly Case[] = [
  [
    "no-unresolvable",
    { "apps/service-member/src/index.ts": 'export * from "@repo/db/src/schema";\n' },
  ],
  [
    "no-unresolvable",
    { "apps/service-member/src/index.ts": 'export type { Row } from "@repo/db/src/schema";\n' },
  ],
  [
    "no-unresolvable",
    { "apps/service-member/src/index.ts": 'export type * from "@repo/db/src/schema";\n' },
  ],
  ["no-unresolvable", { "apps/service-member/src/index.ts": 'import "cloudflare:workerz";\n' }],
  [
    "no-app-to-app",
    { "apps/service-member/src/index.ts": 'export * from "@repo/service-admin";\n' },
  ],
  ["no-shared-to-app", { "libs/auth/src/index.ts": 'export * from "@repo/service-member";\n' }],
  ["no-runtime-to-tools", { "libs/auth/src/index.ts": 'export * from "@repo/dev";\n' }],
  ["no-package-escape", { "libs/auth/src/index.ts": 'export * from "../../db/src/index.ts";\n' }],
  [
    "no-package-escape",
    { "libs/auth/src/index.ts": 'export type { Row } from "../../db/src/index.ts";\n' },
  ],
  [
    "no-database-admin-outside-admin",
    { "apps/service-member/src/index.ts": 'export * from "@repo/db/admin";\n' },
  ],
  ["no-database-admin-outside-admin", { "libs/db/src/index.ts": 'export * from "./admin.ts";\n' }],
  [
    "no-database-operations-outside-tooling",
    { "apps/service-admin/src/index.ts": 'export * from "@repo/db/remote";\n' },
  ],
  [
    "no-testing-entry-outside-tests",
    { "libs/auth/src/index.ts": 'export * from "@repo/db/testing";\n' },
  ],
  ["no-testing-entry-outside-tests", { "libs/db/src/index.ts": 'export * from "./testing.ts";\n' }],
  [
    "no-testing-entry-outside-tests",
    { "tools/dev/src/index.ts": 'export * from "@repo/db/testing";\n' },
  ],
  [
    "no-testing-entry-outside-tests",
    { "libs/runtime/src/index.ts": 'export * from "@repo/observability/testing";\n' },
  ],
  [
    "no-development-dependency-in-shipped-code",
    { "libs/ui/src/index.ts": 'export * from "msw";\n' },
  ],
  [
    "no-development-dependency-in-shipped-code",
    { "libs/ui/src/index.ts": 'export type { Handler } from "msw";\n' },
  ],
  ["no-raw-database-driver", { "libs/auth/src/index.ts": 'export * from "drizzle-orm";\n' }],
  [
    "no-production-to-test",
    {
      "libs/auth/src/helper.test.ts": "export const helper = 1;\n",
      "libs/auth/src/index.ts": 'export * from "./helper.test.ts";\n',
    },
  ],
  [
    "no-signup-outside-user",
    { "apps/service-admin/src/index.ts": 'export * from "@repo/ui/signup";\n' },
  ],
  [
    "no-signup-outside-user",
    { "apps/service-admin/src/index.ts": 'export type { Props } from "@repo/ui/signup";\n' },
  ],
  [
    "no-wiki-to-database",
    { "apps/internal-dashboard/src/index.ts": 'export * from "@repo/db";\n' },
  ],
  [
    "no-wiki-to-database",
    { "apps/internal-dashboard/src/index.ts": 'export type { Db } from "@repo/db";\n' },
  ],
  [
    "no-deployment-config-in-shipped-code",
    { "apps/service-member/src/index.ts": 'export * from "@repo/config/deployment";\n' },
  ],
  [
    "no-deployment-config-in-shipped-code",
    { "libs/config/src/index.ts": 'export * from "./deployment.ts";\n' },
  ],
  [
    "no-deployment-config-in-shipped-code",
    {
      "libs/auth/src/index.ts": 'export * from "./settings.ts";\n',
      "libs/auth/src/settings.ts": 'export * from "@repo/config/deployment";\n',
    },
  ],
  [
    "no-worker-runtime-in-node-test",
    { "libs/auth/src/session.test.ts": 'export * from "cloudflare:test";\n' },
  ],
  [
    "no-worker-runtime-in-node-test",
    {
      "libs/auth/src/binding.ts": 'export * from "cloudflare:workers";\n',
      "libs/auth/src/session.test.ts": 'export * from "./binding.ts";\n',
    },
  ],
  [
    "no-node-builtin-in-worker-test",
    { "libs/auth/src/session.worker.test.ts": 'export * from "node:fs/promises";\n' },
  ],
  [
    "no-node-runtime-package-in-worker-test",
    { "libs/auth/src/session.worker.test.ts": 'export * from "miniflare";\n' },
  ],
  [
    "no-node-runtime-package-in-worker-test",
    {
      "libs/auth/src/harness.ts": 'export * from "miniflare";\n',
      "libs/auth/src/session.worker.test.ts": 'export * from "./harness.ts";\n',
    },
  ],
  [
    "no-browser-to-server",
    {
      "libs/runtime/src/index.ts": 'export * from "@repo/db";\n',
      "libs/ui/src/index.ts": 'export * from "@repo/runtime";\n',
    },
  ],
];

const accepted: readonly Case[] = [
  ["no-unresolvable", { "apps/service-member/src/index.ts": 'export * from "@repo/db";\n' }],
  [
    "no-app-to-app",
    {
      "apps/service-member/src/helper.ts": "export const helper = 1;\n",
      "apps/service-member/src/index.ts": 'export * from "./helper.ts";\n',
    },
  ],
  ["no-shared-to-app", { "libs/auth/src/index.ts": 'export * from "@repo/db";\n' }],
  ["no-runtime-to-tools", { "tools/dev/src/index.ts": 'export * from "@repo/db/remote";\n' }],
  [
    "no-package-escape",
    {
      "libs/auth/src/helper.ts": "export const helper = 1;\n",
      "libs/auth/src/index.ts": 'export * from "./helper.ts";\n',
    },
  ],
  [
    "no-database-admin-outside-admin",
    { "apps/service-admin/src/index.ts": 'export * from "@repo/db/admin";\n' },
  ],
  [
    "no-database-operations-outside-tooling",
    { "tools/dev/src/index.ts": 'export * from "@repo/db/remote";\n' },
  ],
  [
    "no-testing-entry-outside-tests",
    { "libs/auth/src/session.test.ts": 'export * from "@repo/db/testing";\n' },
  ],
  [
    "no-testing-entry-outside-tests",
    { "libs/db/src/records-fixture.ts": 'export * from "./testing.ts";\n' },
  ],
  [
    "no-testing-entry-outside-tests",
    { "libs/runtime/src/index.test.ts": 'export * from "@repo/observability/testing";\n' },
  ],
  [
    "no-development-dependency-in-shipped-code",
    {
      "libs/ui/src/index.ts":
        'import type { Handler } from "msw";\n\nexport type Mocked = Handler;\n',
    },
  ],
  ["no-raw-database-driver", { "libs/db/src/index.ts": 'export * from "drizzle-orm";\n' }],
  [
    "no-production-to-test",
    {
      "libs/auth/src/helper.test.ts": "export const helper = 1;\n",
      "libs/auth/src/session.test.ts": 'export * from "./helper.test.ts";\n',
    },
  ],
  [
    "no-signup-outside-user",
    { "apps/service-member/src/index.ts": 'export * from "@repo/ui/signup";\n' },
  ],
  [
    "no-wiki-to-database",
    { "apps/internal-dashboard/src/index.ts": 'export * from "@repo/db/local";\n' },
  ],
  [
    "no-browser-to-server",
    {
      "libs/runtime/src/index.ts": 'export * from "@repo/db";\n',
      "libs/ui/src/index.ts": 'export * from "@repo/runtime/contracts";\n',
    },
  ],
  [
    "no-deployment-config-in-shipped-code",
    { "tools/dev/src/index.ts": 'export * from "@repo/config/deployment";\n' },
  ],
  [
    "no-worker-runtime-in-node-test",
    { "libs/auth/src/session.worker.test.ts": 'export * from "cloudflare:test";\n' },
  ],
  [
    "no-node-builtin-in-worker-test",
    { "libs/auth/src/session.test.ts": 'export * from "node:fs/promises";\n' },
  ],
  [
    "no-node-runtime-package-in-worker-test",
    { "libs/auth/src/session.test.ts": 'export * from "miniflare";\n' },
  ],
];

const scannedModules = ["libs/db/src/index.ts", "libs/ui/src/index.ts", "tools/quality/plugin.ts"];

interface RepositoryCruise {
  readonly scanned: readonly string[];
  readonly violations: readonly string[];
}

const cruiseRepository = async (): Promise<RepositoryCruise> => {
  const { modules, summary } = await cruiseModules(["apps", "libs", "infra", "tools"]);
  const sources = new Set<string>();
  for (const module of modules) {
    sources.add(module.source);
  }
  return {
    scanned: scannedModules.filter((module) => sources.has(module)),
    violations: reportedRules(summary.violations),
  };
};

describe("dependency-cruiser rules on package boundaries", () => {
  it("every rule has a case that reports it and a case that must stay silent", () => {
    expect.hasAssertions();
    expect({
      accepted: [...new Set(accepted.map(([rule]) => rule))].toSorted(),
      detected: [...new Set(detected.map(([rule]) => rule))].toSorted(),
    }).toStrictEqual({
      accepted: [...configuredRules].toSorted(),
      detected: [...configuredRules].toSorted(),
    });
  });

  it.for(detected)("reports %s", async ([rule, files]) => {
    expect.hasAssertions();
    await expect(violatedRules(files)).resolves.toStrictEqual([rule]);
  });

  it.for(accepted)("stays silent about %s", async ([, files]) => {
    expect.hasAssertions();
    await expect(violatedRules(files)).resolves.toStrictEqual([]);
  });

  it("reaches this repository and finds nothing forbidden in it", async () => {
    expect.hasAssertions();
    await expect(cruiseRepository()).resolves.toStrictEqual({
      scanned: scannedModules,
      violations: [],
    });
  });
});
