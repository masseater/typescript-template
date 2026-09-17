import { Effect, Schema } from "effect";
import { readDecoded, readJson } from "./account-read.ts";
import type { AccountAccess } from "./account-read.ts";
import { STATE_STORE_SCRIPT_NAME } from "./deploy-token.ts";

const Listing = Schema.Struct({
  result: Schema.Array(Schema.Struct({ name: Schema.String })),
});
const Stores = Schema.Struct({ result: Schema.Array(Schema.Struct({ id: Schema.String })) });
const Domains = Schema.Struct({
  result: Schema.Array(Schema.Struct({ hostname: Schema.String })),
});
const Subdomain = Schema.Struct({
  result: Schema.Struct({ subdomain: Schema.optional(Schema.String) }),
});
const VerifiedToken = Schema.Struct({ result: Schema.Struct({ id: Schema.String }) });
const PermissionGroup = Schema.Struct({ name: Schema.String });
const Policy = Schema.Struct({ permission_groups: Schema.Array(PermissionGroup) });
const TokenDetail = Schema.Struct({ result: Schema.Struct({ policies: Schema.Array(Policy) }) });

const stateStorePresent = Effect.fn("stateStorePresent")(function* stateStorePresent(
  access: AccountAccess,
) {
  const reading = yield* readJson(
    access.apiToken,
    `accounts/${access.accountId}/workers/scripts/${STATE_STORE_SCRIPT_NAME}`,
  );
  return reading.found;
});

const secretsStoreCount = Effect.fn("secretsStoreCount")(function* secretsStoreCount(
  access: AccountAccess,
) {
  const stores = yield* readDecoded(
    access,
    `accounts/${access.accountId}/secrets_store/stores`,
    Stores,
  );
  return stores === undefined ? 0 : stores.result.length;
});

const workerNames = Effect.fn("workerNames")(function* workerNames(access: AccountAccess) {
  const listed = yield* readDecoded(
    access,
    `accounts/${access.accountId}/workers/scripts`,
    Listing,
  );
  return listed === undefined ? [] : listed.result.map((script) => script.name);
});

const attachedHostnames = Effect.fn("attachedHostnames")(function* attachedHostnames(
  access: AccountAccess,
) {
  const listed = yield* readDecoded(
    access,
    `accounts/${access.accountId}/workers/domains`,
    Domains,
  );
  return listed === undefined ? [] : listed.result.map((domain) => domain.hostname);
});

const workersSubdomain = Effect.fn("workersSubdomain")(function* workersSubdomain(
  access: AccountAccess,
) {
  const found = yield* readDecoded(
    access,
    `accounts/${access.accountId}/workers/subdomain`,
    Subdomain,
  );
  return found?.result.subdomain;
});

const dnsRecordNames = Effect.fn("dnsRecordNames")(function* dnsRecordNames(
  access: AccountAccess,
  zoneId: string,
) {
  const listed = yield* readDecoded(access, `zones/${zoneId}/dns_records`, Listing);
  return listed === undefined ? [] : listed.result.map((record) => record.name);
});

const grantedPermissions = Effect.fn("grantedPermissions")(function* grantedPermissions(
  access: AccountAccess,
) {
  const verified = yield* readDecoded(
    access,
    `accounts/${access.accountId}/tokens/verify`,
    VerifiedToken,
  );
  if (verified === undefined) {
    return;
  }
  const detail = yield* readDecoded(
    access,
    `accounts/${access.accountId}/tokens/${verified.result.id}`,
    TokenDetail,
  );
  return detail?.result.policies.flatMap((policy) =>
    policy.permission_groups.map((group) => group.name),
  );
});

export {
  attachedHostnames,
  dnsRecordNames,
  grantedPermissions,
  secretsStoreCount,
  stateStorePresent,
  workerNames,
  workersSubdomain,
};
