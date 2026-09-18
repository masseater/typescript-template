import { describe, expect, it } from "vite-plus/test";
import { reported, reportedRules } from "./lint-harness.ts";

const forbidden = [
  [
    "app-deployment-config",
    "apps/user/src/probe.ts",
    'import { secretsFile } from "@repo/config/deployment";',
  ],
  [
    "config-root-deployment-laundering",
    "libs/config/src/index.ts",
    'export * from "./deployment.ts";',
  ],
  [
    "shared-deployment-config",
    "libs/auth/src/probe.ts",
    'export const load = () => import("@repo/config/deployment");',
  ],
] as const;

const allowed = [
  ["infra/cloudflare/src/probe.ts", 'export * from "@repo/config/deployment";'],
  ["libs/config/src/deployment.ts", 'export { homedir } from "node:os";'],
  ["apps/user/src/app/probe.ts", 'export * from "@repo/config";'],
] as const;

describe("deployment configuration boundary", () => {
  it.for(forbidden)(
    "keeps the node-only deployment subpath out of the bundles: %s",
    ([_label, name, code]) => {
      expect.hasAssertions();
      expect(reported("boundaries", name, code)).toBe(true);
    },
  );

  it.for(allowed)(
    "leaves the paths that may resolve the owner's file alone: %s",
    ([name, code]) => {
      expect.hasAssertions();
      expect(reportedRules(name, code)).toStrictEqual([]);
    },
  );
});
