const STATE_STORE_SCRIPT_NAME = "alchemy-state-store";

interface PermissionGroup {
  readonly id?: string | undefined;
  readonly name?: string | undefined;
}

interface RequiredPermission {
  readonly dashboard: string;
  readonly satisfiedBy: readonly { readonly id: string; readonly name: string }[];
  readonly scope: "account" | "zone";
}

const workersScriptsWrite = {
  id: "e086da7e2179491d91ee5f35b3ca210a",
  name: "Workers Scripts Write",
} as const;
const d1Write = { id: "09b2857d1c31407795e75e3fed8617a1", name: "D1 Write" } as const;
const secretsStoreWrite = {
  id: "adc8fa2bc6124928a8b3314dc63a1235",
  name: "Secrets Store Write",
} as const;
const apiTokensWrite = {
  id: "5bc3f8b21c554832afc660159ab75fa4",
  name: "Account API Tokens Write",
} as const;
const apiTokensRead = {
  id: "eb56a6953c034b9d97dd838155666f06",
  name: "Account API Tokens Read",
} as const;
const billingWrite = { id: "6c80e02421494afc9ae14414ed442632", name: "Billing Write" } as const;
const billingRead = { id: "7cf72faf220841aabcfdfab81c43c4f6", name: "Billing Read" } as const;
const observabilityWrite = {
  id: "82c075da3f4647a2a03becd0fe240f8a",
  name: "Workers Observability Write",
} as const;
const workersRoutesWrite = {
  id: "28f4b596e7d643029c524985477ae49a",
  name: "Workers Routes Write",
} as const;
const dnsWrite = { id: "4755a26eedb94da69e1066d98aa820be", name: "DNS Write" } as const;
const dnsRead = { id: "82e64a83756745bbbb1c9c2701bf816b", name: "DNS Read" } as const;
const emailSendingWrite = {
  id: "5df633d6b41c42bcaf5b4a62b9d14b64",
  name: "Email Sending Write",
} as const;
const routingAddressesWrite = {
  id: "e4589eb09e63436686cd64252a3aebeb",
  name: "Email Routing Addresses Write",
} as const;
const routingAddressesRead = {
  id: "5272e56105d04b5897466995b9bd4643",
  name: "Email Routing Addresses Read",
} as const;

const deployTokenPermissions = [
  {
    dashboard: "Account / Workers Scripts / Edit",
    satisfiedBy: [workersScriptsWrite],
    scope: "account",
  },
  { dashboard: "Account / D1 / Edit", satisfiedBy: [d1Write], scope: "account" },
  {
    dashboard: "Account / Secrets Store / Edit",
    satisfiedBy: [secretsStoreWrite],
    scope: "account",
  },
  {
    dashboard: "Account / API Tokens / Edit",
    satisfiedBy: [apiTokensWrite],
    scope: "account",
  },
  {
    dashboard: "Account / API Tokens / Read",
    satisfiedBy: [apiTokensRead, apiTokensWrite],
    scope: "account",
  },
  {
    dashboard: "Account / Billing / Read",
    satisfiedBy: [billingRead, billingWrite],
    scope: "account",
  },
  {
    dashboard: "Account / Workers Observability / Write",
    satisfiedBy: [observabilityWrite],
    scope: "account",
  },
  {
    dashboard: "Account / Email Sending / Write",
    satisfiedBy: [emailSendingWrite],
    scope: "account",
  },
  {
    dashboard: "Account / Email Routing Addresses / Read",
    satisfiedBy: [routingAddressesRead, routingAddressesWrite],
    scope: "account",
  },
  {
    dashboard: "Zone / Workers Routes / Edit",
    satisfiedBy: [workersRoutesWrite],
    scope: "zone",
  },
  { dashboard: "Zone / DNS / Read", satisfiedBy: [dnsRead, dnsWrite], scope: "zone" },
] as const satisfies readonly RequiredPermission[];

function missingPermissions(granted: readonly PermissionGroup[]): readonly string[] {
  const held = new Set(granted.flatMap((group) => [group.id, group.name]));
  return deployTokenPermissions
    .filter(
      (required) =>
        !required.satisfiedBy.some((group) => held.has(group.id) || held.has(group.name)),
    )
    .map((required) => required.dashboard);
}

export { STATE_STORE_SCRIPT_NAME, deployTokenPermissions, missingPermissions };
export type { PermissionGroup, RequiredPermission };
