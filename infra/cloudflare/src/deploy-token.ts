const STATE_STORE_SCRIPT_NAME = "alchemy-state-store";

interface RequiredPermission {
  readonly dashboard: string;
  readonly groups: readonly string[];
  readonly scope: "account" | "zone";
}

const deployTokenPermissions = [
  {
    dashboard: "Account / Workers Scripts / Edit",
    groups: ["Workers Scripts Write"],
    scope: "account",
  },
  { dashboard: "Account / D1 / Edit", groups: ["D1 Write"], scope: "account" },
  {
    dashboard: "Account / Secrets Store / Edit",
    groups: ["Secrets Store Write"],
    scope: "account",
  },
  {
    dashboard: "Account / API Tokens / Edit",
    groups: ["Account API Tokens Write", "API Tokens Write"],
    scope: "account",
  },
  {
    dashboard: "Account / API Tokens / Read",
    groups: ["Account API Tokens Read", "API Tokens Read"],
    scope: "account",
  },
  { dashboard: "Account / Billing / Read", groups: ["Billing Read"], scope: "account" },
  {
    dashboard: "Account / Workers Observability / Write",
    groups: ["Workers Observability Write"],
    scope: "account",
  },
  {
    dashboard: "Zone / Workers Routes / Edit",
    groups: ["Workers Routes Write"],
    scope: "zone",
  },
] as const satisfies readonly RequiredPermission[];

function missingPermissions(granted: readonly string[]): readonly string[] {
  const held = new Set(granted);
  return deployTokenPermissions
    .filter((required) => !required.groups.some((group) => held.has(group)))
    .map((required) => required.dashboard);
}

export { STATE_STORE_SCRIPT_NAME, deployTokenPermissions, missingPermissions };
export type { RequiredPermission };
