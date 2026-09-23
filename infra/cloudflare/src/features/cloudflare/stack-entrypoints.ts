import { fileURLToPath } from "node:url";

import { APPLICATION } from "@repo/config";

import type { StackName } from "./stacks.ts";

const entrypoints = {
  [APPLICATION.admin]: new URL("../../../../../apps/service-admin/alchemy.run.ts", import.meta.url),
  [APPLICATION.user]: new URL("../../../../../apps/service-member/alchemy.run.ts", import.meta.url),
  [APPLICATION.wiki]: new URL(
    "../../../../../apps/internal-dashboard/alchemy.run.ts",
    import.meta.url,
  ),
  "budget-monitor": new URL("../../../../budget-monitor/alchemy.run.ts", import.meta.url),
  core: new URL("../../../../../apps/core/alchemy.run.ts", import.meta.url),
  database: new URL("./database.ts", import.meta.url),
  email: new URL("./email.ts", import.meta.url),
  "error-monitor": new URL("../../../../error-monitor/alchemy.run.ts", import.meta.url),
  flagship: new URL("./flagship.ts", import.meta.url),
  "health-monitor": new URL("../../../../health-monitor/alchemy.run.ts", import.meta.url),
  observability: new URL("./observability.ts", import.meta.url),
  storage: new URL("./storage.ts", import.meta.url),
  tokens: new URL("./tokens.ts", import.meta.url),
  zone: new URL("./zone.ts", import.meta.url),
} as const satisfies Readonly<Record<StackName, URL>>;

function stackEntrypoint(stack: StackName): string {
  return fileURLToPath(entrypoints[stack]);
}

export { stackEntrypoint };
