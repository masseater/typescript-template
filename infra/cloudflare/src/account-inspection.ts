import {
  attachedHostnames,
  dnsRecordNames,
  grantedPermissions,
  secretsStoreCount,
  stateStorePresent,
  workerNames,
  workersSubdomain,
} from "./account-lookup.ts";
import { databaseName, findDatabaseId } from "./database-lookup.ts";
import type { AccountAccess } from "./account-read.ts";
import { Effect } from "effect";
import type { SharedConfig } from "./config.ts";
import type { StateStore } from "./database-guard.ts";
import { applications } from "@template/config";
import { assertDatabaseUnclaimed } from "./database-guard.ts";
import { missingPermissions } from "./deploy-token.ts";

type Occupancy = "free" | "taken";
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

function occupancy(taken: boolean): Occupancy {
  return taken ? "taken" : "free";
}

function presence(found: boolean): Presence {
  return found ? "present" : "absent";
}

function overlaps(found: readonly string[], claimed: readonly string[]): Occupancy {
  return occupancy(found.some((name) => claimed.includes(name)));
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

const dnsVerdict = Effect.fn("dnsVerdict")(function* dnsVerdict(
  access: AccountAccess,
  config: SharedConfig,
) {
  return yield* dnsRecordNames(access, config.zoneId).pipe(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.map((records) => overlaps(records, hostnames(config))),
    Effect.catchTag("CloudflareFailure", () => Effect.succeed("unreadable" as const)),
  );
});

const tokenVerdict = Effect.fn("tokenVerdict")(function* tokenVerdict(access: AccountAccess) {
  return yield* grantedPermissions(access).pipe(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.map((granted) =>
      granted === undefined ? ("unreadable" as const) : missingPermissions(granted),
    ),
    Effect.catchTag("CloudflareFailure", () => Effect.succeed("unreadable" as const)),
  );
});

const inspectAccount = Effect.fn("inspectAccount")(function* inspectAccount<Failure, Requirements>(
  access: AccountAccess,
  config: SharedConfig,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  store: StateStore<Failure, Requirements>,
) {
  return {
    database: yield* databaseVerdict(access, config, store),
    deployToken: yield* tokenVerdict(access),
    dnsRecords: yield* dnsVerdict(access, config),
    secretsStore: presence((yield* secretsStoreCount(access)) > 0),
    stateStore: presence(yield* stateStorePresent(access)),
    workerDomains: overlaps(yield* attachedHostnames(access), hostnames(config)),
    workerNames: overlaps(yield* workerNames(access), declaredNames(config.prefix)),
    workersSubdomain: presence((yield* workersSubdomain(access)) !== undefined),
  };
});

type Inspection = Effect.Success<ReturnType<typeof inspectAccount>>;

function blocked(inspection: Readonly<Inspection>): readonly string[] {
  const occupied = ["database", "dnsRecords", "workerDomains", "workerNames"] as const;
  return [
    ...occupied.filter((name) => inspection[name] === "taken"),
    ...(inspection.workersSubdomain === "absent" ? ["workersSubdomain"] : []),
    ...(inspection.deployToken !== "unreadable" && inspection.deployToken.length > 0
      ? ["deployToken"]
      : []),
  ];
}

export { blocked, inspectAccount };
export type { Inspection };
