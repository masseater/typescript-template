import {
  attachedService,
  dnsRecordNames,
  grantedPermissions,
  secretsStoreCount,
  stateStorePresent,
  workerNames,
  workersSubdomain,
} from "./account-lookup.ts";
import {
  onboardingVerdict,
  senderVerdict,
  sendingRecordNames,
  verifiedAddresses,
} from "./email-lookup.ts";
import type { AccountAccess } from "./account-read.ts";
import { Effect } from "effect";
import type { SharedConfig } from "./config.ts";
import type { StateService } from "alchemy/State";
import { applications } from "@template/config";
import { databaseVerdict } from "./database-guard.ts";
import { missingPermissions } from "./deploy-token.ts";
import { recordedWorkerNames } from "./state-ownership.ts";

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

const recordsPresent = Effect.fn("recordsPresent")(function* recordsPresent(
  access: AccountAccess,
  zoneId: string,
  names: readonly string[],
) {
  const found = yield* Effect.forEach(names, (name) => dnsRecordNames(access, zoneId, name));
  return found.flat().length > 0;
});

const alertQuotaVerdict = Effect.fn("alertQuotaVerdict")(function* alertQuotaVerdict(
  access: AccountAccess,
  recipients: readonly string[],
) {
  const addresses = yield* verifiedAddresses(access).pipe(
    Effect.catchTag("CloudflareFailure", () => Effect.succeed("unreadable" as const)),
  );
  if (typeof addresses === "string") {
    return addresses;
  }
  return recipients.every((recipient) => addresses.includes(recipient))
    ? ("free" as const)
    : ("counted" as const);
});

const tokenVerdict = Effect.fn("tokenVerdict")(function* tokenVerdict(access: AccountAccess) {
  return yield* grantedPermissions(access).pipe(
    Effect.map((granted) => missingPermissions(granted)),
    Effect.catchTag("CloudflareFailure", () =>
      Effect.succeed("unreadable_account_owned_token_required" as const),
    ),
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
  const onboarding = yield* onboardingVerdict(access, config, store);
  return {
    alertQuota: yield* alertQuotaVerdict(access, config.budget.recipients),
    database: yield* databaseVerdict(access, config, store),
    deployToken: yield* tokenVerdict(access),
    dnsRecords: claim(yield* recordsPresent(access, config.zoneId, hostnames(config)), false),
    emailSending: claim(
      yield* recordsPresent(access, config.zoneId, sendingRecordNames(config)),
      onboarding === "owned",
    ),
    secretsStore: presence((yield* secretsStoreCount(access)) > 0),
    senderDomain: yield* senderVerdict(access, config),
    sendingSubdomain: onboarding,
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
    "sendingSubdomain",
    "workerDomains",
    "workerNames",
  ] as const;
  return [
    ...claimed.filter((name) => inspection[name] === "taken"),
    ...(inspection.sendingSubdomain === "unreadable" ? ["sendingSubdomain"] : []),
    ...(inspection.senderDomain === "dedicated" ? [] : ["senderDomain"]),
    ...(inspection.workersSubdomain === "absent" ? ["workersSubdomain"] : []),
    ...(inspection.deployToken.length > 0 ? ["deployToken"] : []),
  ];
}

export { blocked, inspectAccount };
export type { Inspection };
