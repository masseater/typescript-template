import { Effect, Schema } from "effect";

import { endpoint, readList, readRequired, readResource } from "./account-read.ts";
import type { AccountAccess } from "./account-read.ts";
import { STATE_STORE_SCRIPT_NAME } from "./deploy-token.ts";

const SECRETS_STORE_PAGE_SIZE = 100;

const Script = Schema.Struct({ result: Schema.Struct({ id: Schema.String }) });
const Scripts = Schema.Struct({ result: Schema.Array(Schema.Struct({ id: Schema.String })) });
const Stores = Schema.Struct({ result: Schema.Array(Schema.Struct({ id: Schema.String })) });
const Domains = Schema.Struct({
  result: Schema.Array(Schema.Struct({ hostname: Schema.String, service: Schema.String })),
});
const Records = Schema.Struct({ result: Schema.Array(Schema.Struct({ name: Schema.String })) });
const Subdomain = Schema.Struct({
  result: Schema.Struct({ subdomain: Schema.optional(Schema.String) }),
});
const VerifiedToken = Schema.Struct({ result: Schema.Struct({ id: Schema.String }) });
const Group = Schema.Struct({
  id: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
});
const Policy = Schema.Struct({ permission_groups: Schema.Array(Group) });
const TokenDetail = Schema.Struct({ result: Schema.Struct({ policies: Schema.Array(Policy) }) });

const stateStorePresent = Effect.fn("stateStorePresent")(function* stateStorePresent(
  access: AccountAccess,
) {
  const found = yield* readResource(
    access,
    endpoint`accounts/${access.accountId}/workers/scripts/${STATE_STORE_SCRIPT_NAME}`,
    Script,
  );
  return found !== undefined;
});

const secretsStoreCount = Effect.fn("secretsStoreCount")(function* secretsStoreCount(
  access: AccountAccess,
) {
  const listed = yield* readList(
    access,
    {
      pageSize: SECRETS_STORE_PAGE_SIZE,
      source: endpoint`accounts/${access.accountId}/secrets_store/stores`,
    },
    Stores,
  );
  return listed.result.length;
});

const workerNames = Effect.fn("workerNames")(function* workerNames(access: AccountAccess) {
  const listed = yield* readList(
    access,
    { source: endpoint`accounts/${access.accountId}/workers/scripts` },
    Scripts,
  );
  return listed.result.map((script) => script.id);
});

const attachedService = Effect.fn("attachedService")(function* attachedService(
  access: AccountAccess,
  hostname: string,
) {
  const listed = yield* readList(
    access,
    { filter: { hostname }, source: endpoint`accounts/${access.accountId}/workers/domains` },
    Domains,
  );
  return listed.result.find((domain) => domain.hostname === hostname)?.service;
});

const workersSubdomain = Effect.fn("workersSubdomain")(function* workersSubdomain(
  access: AccountAccess,
) {
  const found = yield* readResource(
    access,
    endpoint`accounts/${access.accountId}/workers/subdomain`,
    Subdomain,
  );
  return found?.result.subdomain;
});

const dnsRecordNames = Effect.fn("dnsRecordNames")(function* dnsRecordNames(
  access: AccountAccess,
  zoneId: string,
  hostname: string,
) {
  const listed = yield* readList(
    access,
    { filter: { "name.exact": hostname }, source: endpoint`zones/${zoneId}/dns_records` },
    Records,
  );
  return listed.result.filter((record) => record.name === hostname).map((record) => record.name);
});

const grantedPermissions = Effect.fn("grantedPermissions")(function* grantedPermissions(
  access: AccountAccess,
) {
  const verified = yield* readRequired(
    access,
    endpoint`accounts/${access.accountId}/tokens/verify`,
    VerifiedToken,
  );
  const detail = yield* readRequired(
    access,
    endpoint`accounts/${access.accountId}/tokens/${verified.result.id}`,
    TokenDetail,
  );
  return detail.result.policies.flatMap((policy) => policy.permission_groups);
});

export {
  attachedService,
  dnsRecordNames,
  grantedPermissions,
  secretsStoreCount,
  stateStorePresent,
  workerNames,
  workersSubdomain,
};
