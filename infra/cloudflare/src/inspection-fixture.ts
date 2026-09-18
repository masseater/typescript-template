import { InMemoryService } from "alchemy/State";
import type { StateService } from "alchemy/State";
import type { CreatedResourceState } from "alchemy/State/ResourceState";
import type { Effect } from "effect";
import { HttpResponse, http } from "msw";

import { pagedCollection, unpagedCollection } from "./account-fixture.ts";
import type { mockServer } from "./account-fixture.ts";
import { deployTokenPermissions } from "./deploy-token.ts";
import { stackName } from "./stacks.ts";
import { verificationSettings } from "./verification-fixture.ts";

const config = verificationSettings;
const access = { accountId: config.accountId, apiToken: "inspection-test-not-a-real-token" };
const account = `https://api.cloudflare.com/client/v4/accounts/${access.accountId}`;
const zone = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}`;
const NOT_FOUND_STATUS = 404;
const FORBIDDEN_STATUS = 403;
const SECRETS_STORE_PAGE_LIMIT = 100;
const ADDRESS_PAGE_LIMIT = 50;
const sending = `${config.prefix}.example.com`;
const sendingRecords = [
  `cf-bounce.${sending}`,
  `cf-bounce._domainkey.${sending}`,
  `_dmarc.${sending}`,
];
const RETURNED_PAGE_SIZE = 50;
const ACCOUNT_DATABASE_COUNT = 5;
const tokenId = "0123456789abcdef0123456789abcdef";
const databaseId = "92b705e4-7b3b-42a9-9de3-700a33fa609c";
const hosts = Object.values(config.origins).map((origin) => new URL(origin).hostname);
const workers = ["user", "admin", "wiki", "budget", "errors", "health"].map(
  (suffix) => `${config.prefix}-${suffix}`,
);

function row(resourceType: string, attr: Readonly<Record<string, string>>): CreatedResourceState {
  return {
    attr,
    bindings: [],
    downstream: [],
    fqn: "Resource",
    instanceId: "instance",
    logicalId: "Resource",
    namespace: undefined,
    props: {},
    providerVersion: 1,
    resourceType,
    status: "created",
  };
}

const deployedUnits = [
  ["user", "user"],
  ["admin", "admin"],
  ["wiki", "wiki"],
  ["budget-monitor", "budget"],
  ["error-monitor", "errors"],
  ["health-monitor", "health"],
] as const;

function emptyState(): Effect.Effect<StateService> {
  return InMemoryService({});
}

function deployedState(zoneId: string = config.zoneId): Effect.Effect<StateService> {
  return InMemoryService({
    [stackName("email")]: {
      [config.prefix]: {
        Sending: row("Cloudflare.Email.SendingSubdomain", {
          name: sending,
          subdomainId: "sending-tag",
          zoneId,
        }),
      },
    },
    [stackName("database")]: {
      [config.prefix]: { Database: row("Cloudflare.D1Database", { databaseId }) },
    },
    ...Object.fromEntries(
      deployedUnits.map(([unit, suffix]: readonly [string, string]) => [
        `template-${unit}`,
        {
          [config.prefix]: {
            Worker: row("Cloudflare.Worker", { workerName: `${config.prefix}-${suffix}` }),
          },
        },
      ]),
    ),
  });
}

const unverifiableToken = http.get(`${account}/tokens/verify`, () =>
  HttpResponse.json({ success: false }, { status: NOT_FOUND_STATUS }),
);

const tokenHandlers = [
  http.get(`${account}/tokens/verify`, () => HttpResponse.json({ result: { id: tokenId } })),
  http.get(`${account}/tokens/${tokenId}`, () =>
    HttpResponse.json({
      result: {
        policies: [
          {
            permission_groups: deployTokenPermissions.map((required) => ({
              id: required.satisfiedBy[0].id,
            })),
          },
        ],
      },
    }),
  ),
];

function page(total: number): Readonly<{ per_page: number; total_count: number }> {
  return { per_page: RETURNED_PAGE_SIZE, total_count: total };
}

function rowsAsPage(rows: number): Readonly<{ per_page: number; total_count: number }> {
  return { per_page: rows, total_count: rows };
}

type Domain = Readonly<{ hostname: string; service: string }>;
type Address = Readonly<{ email: string; verified?: string }>;

function domainPage(domains: readonly Domain[], url: string): Response {
  const wanted = new URL(url).searchParams.get("hostname");
  const matching = domains.filter((domain) => domain.hostname === wanted);
  return HttpResponse.json({ result: matching, result_info: rowsAsPage(matching.length) });
}

function dnsPage(records: readonly string[], url: string): Response {
  const wanted = new URL(url).searchParams.get("name.exact");
  const matching = records.filter((record) => record === wanted);
  return HttpResponse.json({
    result: matching.map((name) => ({ name })),
    result_info: page(records.length),
  });
}

function scriptPage(scripts: readonly string[]): Response {
  // oxlint-disable-next-line unicorn/no-null
  return HttpResponse.json({ result: scripts.map((id) => ({ id })), result_info: null });
}

function addressPage(addresses: readonly Address[], url: string): Response {
  const asked = Number(new URL(url).searchParams.get("page"));
  return HttpResponse.json({
    result: addresses.slice((asked - 1) * ADDRESS_PAGE_LIMIT, asked * ADDRESS_PAGE_LIMIT),
    result_info: { per_page: ADDRESS_PAGE_LIMIT, total_count: addresses.length },
  });
}

interface AccountState {
  readonly token?: readonly ReturnType<typeof http.get>[];
  readonly addresses?: readonly Address[];
  readonly databases?: readonly { readonly name: string; readonly uuid: string }[];
  readonly domains?: readonly Domain[];
  readonly records?: readonly string[];
  readonly scripts?: readonly string[];
  readonly stores?: number;
  readonly subdomains?: readonly string[];
  readonly zoneName?: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function accountHandlers(options: AccountState): Parameters<typeof mockServer> {
  return [
    ...(options.token ?? tokenHandlers),
    unpagedCollection(`${account}/d1/database`, () =>
      HttpResponse.json({
        result: options.databases ?? [],
        result_info: page(ACCOUNT_DATABASE_COUNT),
        success: true,
      }),
    ),
    pagedCollection(`${account}/secrets_store/stores`, SECRETS_STORE_PAGE_LIMIT, () =>
      HttpResponse.json({
        result: Array.from({ length: options.stores ?? 0 }, () => ({ id: "s" })),
        result_info: page(options.stores ?? 0),
      }),
    ),
    unpagedCollection(`${account}/workers/scripts`, () => scriptPage(options.scripts ?? [])),
    unpagedCollection(`${account}/workers/domains`, ({ request }) =>
      domainPage(options.domains ?? [], request.url),
    ),
    http.get(`${account}/workers/subdomain`, () =>
      HttpResponse.json({ result: { subdomain: "example-subdomain" } }),
    ),
    unpagedCollection(`${zone}/dns_records`, ({ request }) =>
      dnsPage(options.records ?? [], request.url),
    ),
    pagedCollection(`${account}/email/routing/addresses`, ADDRESS_PAGE_LIMIT, ({ request }) =>
      addressPage(options.addresses ?? [], request.url),
    ),
    unpagedCollection(`${zone}/email/sending/subdomains`, () =>
      HttpResponse.json({
        result: (options.subdomains ?? []).map((name) => ({ enabled: true, name, tag: name })),
        result_info: rowsAsPage(options.subdomains?.length ?? 0),
      }),
    ),
    http.get(zone, () =>
      HttpResponse.json({ result: { name: options.zoneName ?? "example.com" } }),
    ),
  ];
}

export {
  FORBIDDEN_STATUS,
  access,
  account,
  accountHandlers,
  config,
  databaseId,
  deployedState,
  emptyState,
  hosts,
  sending,
  sendingRecords,
  unverifiableToken,
  workers,
  zone,
};
