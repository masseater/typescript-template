import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { monitorCheckUrl } from "./binding.ts";

import type { Outcome } from "./monitor-test-fixture.ts";

const probeAlert = { subject: "probe alert", text: "probe alert" } as const;
const probeFailure = { subject: "probe failed", text: "probe failed" } as const;

describe("a monitor check", () => {
  const it = test.extend("checks", () =>
    Effect.runPromise(
      Effect.forEach(["succeed", "notify", "fail", "die"] satisfies Outcome[], (probeMode) =>
        Effect.gen(function* checkProbe() {
          const stub = env.MONITOR.get(env.MONITOR.idFromName(`probe-${probeMode}`));
          yield* Effect.promise(() => env.EMAIL.taken());
          yield* Effect.promise(() =>
            runInDurableObject(stub, (_probeMonitor, durableState) =>
              durableState.storage.put("outcome", probeMode),
            ),
          );
          const checkResponse = yield* Effect.promise(() =>
            stub.fetch(monitorCheckUrl, { method: "POST" }),
          );
          const checkReport: unknown = yield* Effect.promise(() => checkResponse.json());
          const sentMail = yield* Effect.promise(() => env.EMAIL.taken());
          return {
            checkReport,
            mail: sentMail.map(({ subject, text }) => ({ subject, text })),
            status: checkResponse.status,
          };
        }),
      ),
    ));

  it("reports success without mail, delivers raised alerts, and mails the failure notice for failures and defects", ({
    checks,
  }) => {
    expect(checks).toStrictEqual([
      { checkReport: { ok: true, outcome: "succeed" }, mail: [], status: 200 },
      { checkReport: { ok: true, outcome: "notify" }, mail: [probeAlert], status: 200 },
      {
        checkReport: { ok: false, reason: "MonitorFailure.alert_config_invalid" },
        mail: [probeFailure],
        status: 500,
      },
      { checkReport: { ok: false, reason: "unrecognized" }, mail: [probeFailure], status: 500 },
    ]);
  });
});

describe("a monitor check whose stored state has the wrong shape", () => {
  const it = test.extend("check", () =>
    Effect.runPromise(
      Effect.gen(function* checkMalformedProbe() {
        const stub = env.MONITOR.get(env.MONITOR.idFromName("probe-malformed"));
        yield* Effect.promise(() => env.EMAIL.taken());
        yield* Effect.promise(() =>
          runInDurableObject(stub, async (_probeMonitor, durableState) => {
            await durableState.storage.put("outcome", 42);
            await durableState.storage.put("failureNotifiedDay", { day: "yesterday" });
          }),
        );
        const checkResponse = yield* Effect.promise(() =>
          stub.fetch(monitorCheckUrl, { method: "POST" }),
        );
        const checkReport: unknown = yield* Effect.promise(() => checkResponse.json());
        const sentMail = yield* Effect.promise(() => env.EMAIL.taken());
        return {
          checkReport,
          mail: sentMail.map(({ subject, text }) => ({ subject, text })),
          status: checkResponse.status,
        };
      }),
    ));

  it("fails the check naming the key and still mails the failure notice", ({ check }) => {
    expect(check).toStrictEqual({
      checkReport: { ok: false, reason: "StoredStateInvalid.stored_state_invalid:outcome" },
      mail: [probeFailure],
      status: 500,
    });
  });
});
