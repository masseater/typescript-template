import {
  access,
  accountHandlers,
  config,
  deployedState,
  emptyState,
  sending,
  sendingRecords,
} from "./inspection-fixture.ts";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { assertSendingDomainUnclaimed } from "./email-guard.ts";
import { describeFailure } from "./secrets.ts";
import { mockServer } from "./account-fixture.ts";

const otherZoneId = "c".repeat(config.zoneId.length);

it.effect("stops a deploy against every account state the inspection refuses", () =>
  Effect.forEach(
    [
      { refused: ["emailSending"], state: { records: sendingRecords } },
      { refused: ["sendingSubdomain"], state: { subdomains: ["*.example.com"] } },
      { refused: ["senderDomain"], state: { zoneName: "elsewhere.example" } },
      { refused: ["senderDomain"], state: { zoneName: "com" } },
    ] as const,
    (asked) =>
      Effect.gen(function* program() {
        yield* mockServer(...accountHandlers(asked.state));
        const failure = yield* assertSendingDomainUnclaimed(access, config, emptyState()).pipe(
          Effect.flip,
        );
        assert.deepStrictEqual(describeFailure(failure, []), {
          code: "sending_domain_unavailable",
          keys: asked.refused,
        });
      }).pipe(Effect.scoped),
  ),
);

it.effect("lets a first deploy through when nothing holds the sending domain", () =>
  Effect.gen(function* program() {
    yield* mockServer(...accountHandlers({ subdomains: ["other.example.com"] }));
    assert.isUndefined(yield* assertSendingDomainUnclaimed(access, config, emptyState()));
  }).pipe(Effect.scoped),
);

it.effect("lets a repeat deploy through when state records this deployment's own onboarding", () =>
  Effect.gen(function* program() {
    yield* mockServer(...accountHandlers({ records: sendingRecords, subdomains: [sending] }));
    assert.isUndefined(yield* assertSendingDomainUnclaimed(access, config, deployedState()));
  }).pipe(Effect.scoped),
);

it.effect("stops when the recorded onboarding belongs to another zone", () =>
  Effect.gen(function* program() {
    yield* mockServer(...accountHandlers({ records: sendingRecords, subdomains: [sending] }));
    const failure = yield* assertSendingDomainUnclaimed(
      access,
      config,
      deployedState(otherZoneId),
    ).pipe(Effect.flip);
    assert.deepStrictEqual([...failure.keys], ["emailSending", "sendingSubdomain"]);
  }).pipe(Effect.scoped),
);
