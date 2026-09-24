import { APPLICATION, wikiWorker } from "@repo/config";
import { repositoryRoot } from "@repo/config/repository-root";

import { fileUrlPath, path } from "./platform.ts";

import type { MonitorStack } from "./monitors.ts";
import type { PackageStack, StackName } from "./stacks.ts";

const applicationEntrypoints = {
  [APPLICATION.admin]: path.join(repositoryRoot, "apps", APPLICATION.admin, "alchemy.run.ts"),
  [APPLICATION.user]: path.join(repositoryRoot, "apps", APPLICATION.user, "alchemy.run.ts"),
  [APPLICATION.wiki]: path.join(repositoryRoot, "apps", APPLICATION.wiki, "alchemy.run.ts"),
  core: path.join(repositoryRoot, "apps", "core", "alchemy.run.ts"),
  [wikiWorker]: path.join(repositoryRoot, "apps", wikiWorker, "alchemy.run.ts"),
} as const satisfies Readonly<Record<PackageStack, string>>;

const monitorEntrypoints = {
  "budget-monitor": path.join(repositoryRoot, "infra", "budget-monitor", "alchemy.run.ts"),
  "error-monitor": path.join(repositoryRoot, "infra", "error-monitor", "alchemy.run.ts"),
  "health-monitor": path.join(repositoryRoot, "infra", "health-monitor", "alchemy.run.ts"),
} as const satisfies Readonly<Record<MonitorStack, string>>;

const cloudflareEntrypoints = {
  database: fileUrlPath(new URL("./database.ts", import.meta.url)),
  email: fileUrlPath(new URL("./email.ts", import.meta.url)),
  flagship: fileUrlPath(new URL("./flagship.ts", import.meta.url)),
  observability: fileUrlPath(new URL("./observability.ts", import.meta.url)),
  storage: fileUrlPath(new URL("./storage.ts", import.meta.url)),
  tokens: fileUrlPath(new URL("./tokens.ts", import.meta.url)),
  zone: fileUrlPath(new URL("./zone.ts", import.meta.url)),
} as const satisfies Readonly<Record<Exclude<StackName, PackageStack | MonitorStack>, string>>;

const entrypoints = {
  ...applicationEntrypoints,
  ...monitorEntrypoints,
  ...cloudflareEntrypoints,
} as const satisfies Readonly<Record<StackName, string>>;

function stackEntrypoint(stack: StackName): string {
  return entrypoints[stack];
}

export { stackEntrypoint };
