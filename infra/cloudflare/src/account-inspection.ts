import { applications } from "@repo/config";
import { Effect } from "effect";

import {
  attachedService,
  grantedPermissions,
  recordsPresent,
  secretsStoreCount,
  workerNames,
  workersSubdomain,
} from "./account-lookup.ts";
import { isUnreadable, readVerdict, unreadableVerdict } from "./account-read.ts";
import { databaseVerdict } from "./database-guard.ts";
import { STATE_STORE_SCRIPT_NAME, missingPermissions } from "./deploy-token.ts";
import { alertQuotaVerdict, emailBlocked, emailVerdicts } from "./email-guard.ts";
import { recordedWorkerNames } from "./state-ownership.ts";

import type { StateService } from "alchemy/State";
import type { AccountAccess } from "./account-read.ts";
import type { SharedConfig } from "./config.ts";

type Claim = "free" | "owned" | "taken";
type Presence = "absent" | "present";

const monitorSuffixes = ["budget", "errors", "health"] as const;
const tokenSuffixes = ["billing-read", "observability-query"] as const;

function declaredNames(prefix: string): readonly string[] {
  return [...applications, ...monitorSuffixes, ...tokenSuffixes].map(
    (suffix) => `${prefix}-${suffix}`,
  );
}

function hostnames(config: SharedConfig): readonly string[] {
  return Object.values(config.origins).map((origin) => new URL(origin).hostname);
}

function presence(found: boolean): Presence {
  return found ? "present" : "absent";
}

function claim(present: boolean, owned: boolean): Claim {
  if (!present) {
    return "free";
  }
  return owned ? "owned" : "taken";
}

function workerVerdict(
  live: readonly string[],
  declared: readonly string[],
  recorded: readonly string[],
): Claim {
  const running = new Set(live);
  const present = declared.filter((name) => running.has(name));
  return claim(
    present.length > 0,
    present.every((name) => recorded.includes(name)),
  );
}

const domainVerdict = Effect.fn("domainVerdict")(function* domainVerdict(
  access: AccountAccess,
  config: SharedConfig,
  recorded: readonly string[],
) {
  const services = yield* Effect.forEach(hostnames(config), (hostname) =>
    attachedService(access, hostname),
  ).pipe(Effect.catchTag("CloudflareFailure", unreadableVerdict));
  return readVerdict(services, (attachable) => {
    const attached = attachable.flatMap((service) => (service === undefined ? [] : [service]));
    return claim(
      attached.length > 0,
      attached.length === attachable.length && attached.every((name) => recorded.includes(name)),
    );
  });
});

const tokenVerdict = Effect.fn("tokenVerdict")(function* tokenVerdict(access: AccountAccess) {
  return yield* grantedPermissions(access).pipe(
    Effect.map((granted) => missingPermissions(granted)),
    Effect.catchTag("CloudflareFailure", unreadableVerdict),
  );
});

const inspectAccount = Effect.fn("inspectAccount")(function* inspectAccount<Failure, Requirements>(
  access: AccountAccess,
  config: SharedConfig,
  store: Effect.Effect<StateService, Failure, Requirements>,
) {
  const recorded = yield* recordedWorkerNames(store, config.prefix).pipe(
    Effect.catchCause(() => Effect.succeed<readonly string[]>([])),
  );
  const email = yield* emailVerdicts(access, config, store);
  const scripts = yield* workerNames(access).pipe(
    Effect.catchTag("CloudflareFailure", unreadableVerdict),
  );
  const records = yield* recordsPresent(access, config.zoneId, hostnames(config)).pipe(
    Effect.catchTag("CloudflareFailure", unreadableVerdict),
  );
  const stores = yield* secretsStoreCount(access).pipe(
    Effect.catchTag("CloudflareFailure", unreadableVerdict),
  );
  const subdomain = yield* workersSubdomain(access).pipe(
    Effect.catchTag("CloudflareFailure", unreadableVerdict),
  );
  return {
    alertQuota: yield* alertQuotaVerdict(access, config.budget.recipients),
    database: yield* databaseVerdict(access, config, store).pipe(
      Effect.catchTag("CloudflareFailure", unreadableVerdict),
    ),
    deployToken: yield* tokenVerdict(access),
    dnsRecords: readVerdict(records, (present) => claim(present, false)),
    emailSending: email.emailSending,
    secretsStore: readVerdict(stores, (counted) => presence(counted > 0)),
    senderDomain: email.senderDomain,
    sendingSubdomain: email.sendingSubdomain,
    stateStore: readVerdict(scripts, (live) => presence(live.includes(STATE_STORE_SCRIPT_NAME))),
    workerDomains: yield* domainVerdict(access, config, recorded),
    workerNames: readVerdict(scripts, (live) =>
      workerVerdict(live, declaredNames(config.prefix), recorded),
    ),
    workersSubdomain: readVerdict(subdomain, (found) => presence(found !== undefined)),
  };
});

type Inspection = Effect.Success<ReturnType<typeof inspectAccount>>;

function blocked(inspection: Readonly<Inspection>): readonly string[] {
  const claimed = ["database", "dnsRecords", "workerDomains", "workerNames"] as const;
  const { deployToken } = inspection;
  return [
    ...new Set([
      ...Object.entries(inspection).flatMap(([name, verdict]) =>
        isUnreadable(verdict) ? [name] : [],
      ),
      ...claimed.filter((name) => inspection[name] === "taken"),
      ...emailBlocked(inspection),
      ...(inspection.workersSubdomain === "absent" ? ["workersSubdomain"] : []),
      ...(isUnreadable(deployToken) || deployToken.length === 0 ? [] : ["deployToken"]),
    ]),
  ];
}

export { blocked, inspectAccount };
export type { Inspection };
