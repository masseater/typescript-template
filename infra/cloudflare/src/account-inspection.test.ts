import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { mockServer } from "./account-fixture.ts";
import { blocked, inspectAccount } from "./account-inspection.ts";
import {
  access,
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
} from "./inspection-fixture.ts";

it.effect("clears an account that holds nothing this deployment claims", () =>
  Effect.gen(function* program() {
    yield* mockServer(...accountHandlers({ scripts: ["unrelated-worker"] }));
    const inspection = yield* inspectAccount(access, config, emptyState());
    assert.deepStrictEqual(blocked(inspection), []);
    assert.deepInclude(inspection, {
      alertQuota: "counted",
      database: "free",
      deployToken: [],
      emailSending: "free",
      senderDomain: "dedicated",
      sendingSubdomain: "free",
      workerDomains: "free",
      workerNames: "free",
    });
  }).pipe(Effect.scoped),
);

it.effect("clears the account this deployment has just finished applying to", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      ...accountHandlers({
        addresses: config.budget.recipients.map((email) => ({ email, verified: "2026-01-01" })),
        databases: [{ name: `${config.prefix}-db`, uuid: databaseId }],
        domains: hosts.map((hostname, index) => ({ hostname, service: workers[index] ?? "" })),
        records: sendingRecords,
        scripts: workers,
        stores: 1,
        subdomains: [sending],
      }),
    );
    const inspection = yield* inspectAccount(access, config, deployedState());
    assert.deepStrictEqual(blocked(inspection), []);
    assert.deepInclude(inspection, {
      alertQuota: "free",
      database: "owned",
      emailSending: "owned",
      sendingSubdomain: "owned",
      workerDomains: "owned",
      workerNames: "owned",
    });
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
    yield* mockServer(...accountHandlers({ token: [unverifiableToken] }));
    const inspection = yield* inspectAccount(access, config, emptyState());
    assert.deepStrictEqual(blocked(inspection), ["deployToken"]);
    assert.strictEqual(inspection.deployToken, "unreadable_account_owned_token_required");
  }).pipe(Effect.scoped),
);
