import { assert, it } from "@effect/vitest";
import { InMemoryService } from "alchemy/State";
import type { StateService } from "alchemy/State";
import type { CreatedResourceState } from "alchemy/State/ResourceState";
import { Effect } from "effect";
import { HttpResponse, http } from "msw";

import { mockServer, pagedCollection, unpagedCollection } from "./account-fixture.ts";
import { blocked, inspectAccount } from "./account-inspection.ts";
import { deployTokenPermissions } from "./deploy-token.ts";
import { stackName } from "./stacks.ts";
import { verificationSettings } from "./verification-fixture.ts";

const config = verificationSettings;
const access = { accountId: config.accountId, apiToken: "inspection-test-not-a-real-token" };
const account = `https://api.cloudflare.com/client/v4/accounts/${access.accountId}`;
const zone = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}`;
const NOT_FOUND_STATUS = 404;
const SECRETS_STORE_PAGE_LIMIT = 100;
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
  // oxlint-disable-next-line new-cap
  return InMemoryService({});
}

function deployedState(): Effect.Effect<StateService> {
  // oxlint-disable-next-line new-cap
  return InMemoryService({
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

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function accountHandlers(options: {
  readonly token?: readonly ReturnType<typeof http.get>[];
  readonly databases: readonly { readonly name: string; readonly uuid: string }[];
  readonly domains: readonly { readonly hostname: string; readonly service: string }[];
  readonly records: readonly string[];
  readonly scripts: readonly string[];
  readonly stores: number;
}): Parameters<typeof mockServer> {
  return [
    ...(options.token ?? tokenHandlers),
    unpagedCollection(`${account}/d1/database`, () =>
      HttpResponse.json({
        result: options.databases,
        result_info: page(ACCOUNT_DATABASE_COUNT),
        success: true,
      }),
    ),
    http.get(`${account}/workers/scripts/alchemy-state-store`, () =>
      HttpResponse.json({ success: false }, { status: NOT_FOUND_STATUS }),
    ),
    pagedCollection(`${account}/secrets_store/stores`, SECRETS_STORE_PAGE_LIMIT, () =>
      HttpResponse.json({
        result: Array.from({ length: options.stores }, () => ({ id: "s" })),
        result_info: page(options.stores),
      }),
    ),
    unpagedCollection(`${account}/workers/scripts`, () =>
      // oxlint-disable-next-line unicorn/no-null
      HttpResponse.json({ result: options.scripts.map((id) => ({ id })), result_info: null }),
    ),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    unpagedCollection(`${account}/workers/domains`, ({ request }) => {
      const wanted = new URL(request.url).searchParams.get("hostname");
      const matching = options.domains.filter((domain) => domain.hostname === wanted);
      return HttpResponse.json({ result: matching, result_info: rowsAsPage(matching.length) });
    }),
    http.get(`${account}/workers/subdomain`, () =>
      HttpResponse.json({ result: { subdomain: "example-subdomain" } }),
    ),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    unpagedCollection(`${zone}/dns_records`, ({ request }) => {
      const wanted = new URL(request.url).searchParams.get("name.exact");
      const matching = options.records.filter((record) => record === wanted);
      return HttpResponse.json({
        result: matching.map((name) => ({ name })),
        result_info: page(options.records.length),
      });
    }),
  ];
}

it.effect("clears an account that holds nothing this deployment claims", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      ...accountHandlers({
        databases: [],
        domains: [],
        records: [],
        scripts: ["unrelated-worker"],
        stores: 0,
      }),
    );
    const inspection = yield* inspectAccount(access, config, emptyState());
    assert.deepStrictEqual(blocked(inspection), []);
    assert.deepStrictEqual(inspection.database, "free");
    assert.deepStrictEqual(inspection.workerNames, "free");
    assert.deepStrictEqual(inspection.workerDomains, "free");
    assert.deepStrictEqual(inspection.deployToken, []);
  }).pipe(Effect.scoped),
);

it.effect("clears the account this deployment has just finished applying to", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      ...accountHandlers({
        databases: [{ name: `${config.prefix}-db`, uuid: databaseId }],
        domains: hosts.map((hostname, index) => ({
          hostname,
          service: workers[index] ?? "",
        })),
        records: [],
        scripts: workers,
        stores: 1,
      }),
    );
    const inspection = yield* inspectAccount(access, config, deployedState());
    assert.deepStrictEqual(blocked(inspection), []);
    assert.strictEqual(inspection.database, "owned");
    assert.strictEqual(inspection.workerNames, "owned");
    assert.strictEqual(inspection.workerDomains, "owned");
  }).pipe(Effect.scoped),
);

it.effect("blocks only the names an unrelated project is holding", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      ...accountHandlers({
        databases: [{ name: `${config.prefix}-db`, uuid: "11111111-2222-3333-4444-555555555555" }],
        domains: [{ hostname: hosts[0] ?? "", service: "someone-elses-worker" }],
        records: [hosts[1] ?? ""],
        scripts: [`${config.prefix}-user`],
        stores: 0,
      }),
    );
    const inspection = yield* inspectAccount(access, config, emptyState());
    assert.deepStrictEqual(blocked(inspection).toSorted(), [
      "database",
      "dnsRecords",
      "workerDomains",
      "workerNames",
    ]);
  }).pipe(Effect.scoped),
);

it.effect("blocks when the token cannot be read or is missing a permission", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      ...accountHandlers({
        databases: [],
        domains: [],
        records: [],
        scripts: [],
        stores: 0,
        token: [unverifiableToken],
      }),
    );
    const inspection = yield* inspectAccount(access, config, emptyState());
    assert.deepStrictEqual(blocked(inspection), ["deployToken"]);
    assert.strictEqual(inspection.deployToken, "unreadable_account_owned_token_required");
  }).pipe(Effect.scoped),
);
