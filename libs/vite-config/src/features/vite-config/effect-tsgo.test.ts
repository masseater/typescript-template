import { repositoryRoot } from "@repo/config/repository-root";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { awaitingEffectDiagnostics, effectDiagnostics, effectTsgoNoEmit } from "./effect-tsgo.ts";
import { baselinePath } from "./effect-typecheck.ts";
import { filesystem, paths } from "./host.ts";
import { taskInput } from "./task-input.ts";

const generatedTreeExclusions = [
  { base: "workspace", pattern: "!**/node_modules/**" },
  { base: "workspace", pattern: "!**/dist/**" },
  { base: "workspace", pattern: "!**/.paraglide/**" },
  { base: "workspace", pattern: "!**/.local/**" },
];

describe("effectDiagnostics", () => {
  const it = test
    .extend("libraryDiagnostics", () =>
      effectDiagnostics(paths.join(repositoryRoot, "libs/db-local")))
    .extend("rootDiagnostics", () => effectDiagnostics(repositoryRoot));

  it("names the files of the package and of every workspace package it depends on, without the package root listing", ({
    libraryDiagnostics,
  }) => {
    expect(libraryDiagnostics).toStrictEqual({
      "check:effect": {
        command: effectTsgoNoEmit("tsconfig.json"),
        input: [
          ...taskInput,
          ...[
            "libs/cli",
            "libs/config",
            "libs/db",
            "libs/db-local",
            "libs/observability",
            "libs/vite-config",
          ].flatMap((directory) => [
            { base: "workspace", pattern: `${directory}/**/*.{ts,tsx}` },
            { base: "workspace", pattern: `${directory}/**/package.json` },
            { base: "workspace", pattern: `${directory}/**/tsconfig*.json` },
          ]),
          ...generatedTreeExclusions,
          { base: "package", pattern: "!." },
        ],
      },
    });
  });

  it("covers the root and its dependencies, excludes the nested packages it does not depend on, and keeps the root listing that `!.` would turn into every path", ({
    rootDiagnostics,
  }) => {
    expect(rootDiagnostics).toStrictEqual({
      "check:effect": {
        command: effectTsgoNoEmit("tsconfig.json"),
        input: [
          ...taskInput,
          { base: "workspace", pattern: "**/*.{ts,tsx}" },
          { base: "workspace", pattern: "**/package.json" },
          { base: "workspace", pattern: "**/tsconfig*.json" },
          ...[
            "infra/cloudflare",
            "libs/auth",
            "libs/cli",
            "libs/config",
            "libs/core-api",
            "libs/db",
            "libs/db-local",
            "libs/feature-flags",
            "libs/monitor",
            "libs/observability",
            "libs/runtime",
            "libs/vite-config",
            "tools/ai-native-telemetry",
            "tools/dont-review-it",
          ].flatMap((directory) => [
            { base: "workspace", pattern: `${directory}/**/*.{ts,tsx}` },
            { base: "workspace", pattern: `${directory}/**/package.json` },
            { base: "workspace", pattern: `${directory}/**/tsconfig*.json` },
          ]),
          ...[
            "apps/core",
            "apps/internal-dashboard",
            "apps/internal-wiki",
            "apps/service-admin",
            "apps/service-member",
            "infra/budget-monitor",
            "infra/error-monitor",
            "infra/github",
            "infra/health-monitor",
            "infra/local",
            "libs/auth-ui",
            "libs/ui",
            "tools/ai-native",
            "tools/dev",
            "tools/e2e",
            "tools/load",
          ].map((directory) => ({ base: "workspace", pattern: `!${directory}/**` })),
          ...generatedTreeExclusions,
        ],
      },
    });
  });
});

describe("awaitingEffectDiagnostics", () => {
  const it = test
    .extend("awaitingDiagnostics", () =>
      awaitingEffectDiagnostics(paths.join(repositoryRoot, "apps/service-admin")))
    .extend("baselineExists", () => Effect.runPromise(filesystem.exists(baselinePath)));

  it("adds the typecheck baseline it compares against to the inputs of the plain diagnostics", ({
    awaitingDiagnostics,
  }) => {
    expect(awaitingDiagnostics).toStrictEqual({
      "check:effect": {
        command: "check-effect-typecheck",
        input: [
          ...effectDiagnostics(paths.join(repositoryRoot, "apps/service-admin"))["check:effect"]
            .input,
          {
            base: "workspace",
            pattern: paths.relative(repositoryRoot, baselinePath).split(paths.sep).join("/"),
          },
        ],
      },
    });
  });

  it("points at a baseline that exists", ({ baselineExists }) => {
    expect(baselineExists).toBe(true);
  });
});
