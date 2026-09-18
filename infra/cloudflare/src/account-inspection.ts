import {
  attachedService,
  dnsRecordNames,
  grantedPermissions,
  secretsStoreCount,
  stateStorePresent,
  verifiedAddresses,
  workerNames,
  workersSubdomain,
} from "./account-lookup.ts";
import { databaseName, findDatabaseId } from "./database-lookup.ts";
import type { AccountAccess } from "./account-read.ts";
import { Effect } from "effect";
import type { SharedConfig } from "./config.ts";
import type { StateStore } from "./state-ownership.ts";
import { applications } from "@template/config";
import { assertDatabaseUnclaimed } from "./database-guard.ts";
import { missingPermissions } from "./deploy-token.ts";
import { recordedWorkerNames } from "./state-ownership.ts";
import { sendingDomain } from "./config.ts";

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

function sendingRecordNames(config: SharedConfig): readonly string[] {
  const domain = sendingDomain(config.mailFrom);
  return [`cf-bounce.${domain}`, `cf-bounce._domainkey.${domain}`];
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

const databaseVerdict = Effect.fn("databaseVerdict")(function* databaseVerdict<
  Failure,
  Requirements,
>(
  access: AccountAccess,
  config: SharedConfig,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  store: StateStore<Failure, Requirements>,
) {
  if ((yield* findDatabaseId(access, databaseName(config.prefix))) === undefined) {
    return "free" as const;
  }
  return yield* assertDatabaseUnclaimed(access, config, store).pipe(
    Effect.as("owned" as const),
    Effect.catchCause(() => Effect.succeed("taken" as const)),
  );
});

const workerVerdict = Effect.fn("workerVerdict")(function* workerVerdict(
  access: AccountAccess,
  declared: readonly string[],
  recorded: readonly string[],
) {
  const live = new Set(yield* workerNames(access));
  const present = declared.filter((name) => live.has(name));
  return claim(
    present.length > 0,
    present.every((name) => recorded.includes(name)),
  );
});

const domainVerdict = Effect.fn("domainVerdict")(function* domainVerdict(
  access: AccountAccess,
  config: SharedConfig,
  recorded: readonly string[],
) {
  const services = yield* Effect.forEach(hostnames(config), (hostname) =>
    attachedService(access, hostname),
  );
  const attached = services.flatMap((service) => (service === undefined ? [] : [service]));
  return claim(
    attached.length > 0,
    attached.length === services.length && attached.every((name) => recorded.includes(name)),
  );
});

const dnsVerdict = Effect.fn("dnsVerdict")(function* dnsVerdict(
  access: AccountAccess,
  zoneId: string,
  names: readonly string[],
) {
  const found = yield* Effect.forEach(names, (name) => dnsRecordNames(access, zoneId, name));
  return found.flat().length > 0 ? ("taken" as const) : ("free" as const);
});

const alertVerdict = Effect.fn("alertVerdict")(function* alertVerdict(
  access: AccountAccess,
  recipients: readonly string[],
) {
  const verified = new Set(yield* verifiedAddresses(access));
  return recipients.every((recipient) => verified.has(recipient))
    ? ("verified" as const)
    : ("unverified" as const);
});

const tokenVerdict = Effect.fn("tokenVerdict")(function* tokenVerdict(access: AccountAccess) {
  return yield* grantedPermissions(access).pipe(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.map((granted) => missingPermissions(granted)),
    Effect.catchTag("CloudflareFailure", () =>
      Effect.succeed("unreadable_account_owned_token_required" as const),
    ),
  );
});

const inspectAccount = Effect.fn("inspectAccount")(function* inspectAccount<Failure, Requirements>(
  access: AccountAccess,
  config: SharedConfig,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  store: StateStore<Failure, Requirements>,
) {
  const recorded = yield* recordedWorkerNames(store, config.prefix).pipe(
    Effect.catchCause(() => Effect.succeed<readonly string[]>([])),
  );
  return {
    alertAddresses: yield* alertVerdict(access, config.budget.recipients),
    database: yield* databaseVerdict(access, config, store),
    deployToken: yield* tokenVerdict(access),
    dnsRecords: yield* dnsVerdict(access, config.zoneId, hostnames(config)),
    emailSending: yield* dnsVerdict(access, config.zoneId, sendingRecordNames(config)),
    secretsStore: presence((yield* secretsStoreCount(access)) > 0),
    stateStore: presence(yield* stateStorePresent(access)),
    workerDomains: yield* domainVerdict(access, config, recorded),
    workerNames: yield* workerVerdict(access, declaredNames(config.prefix), recorded),
    workersSubdomain: presence((yield* workersSubdomain(access)) !== undefined),
  };
});

type Inspection = Effect.Success<ReturnType<typeof inspectAccount>>;

function blocked(inspection: Readonly<Inspection>): readonly string[] {
  const claimed = [
    "database",
    "dnsRecords",
    "emailSending",
    "workerDomains",
    "workerNames",
  ] as const;
  return [
    ...claimed.filter((name) => inspection[name] === "taken"),
    ...(inspection.workersSubdomain === "absent" ? ["workersSubdomain"] : []),
    ...(inspection.deployToken.length > 0 ? ["deployToken"] : []),
  ];
}

export { blocked, inspectAccount };
export type { Inspection };
