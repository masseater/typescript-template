import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { probeAlert, probeFailure } from "./monitor-test-fixture.ts";

import type { Outcome } from "./monitor-test-fixture.ts";

const checkedWith = (outcome: Outcome) =>
  Effect.runPromise(
    Effect.gen(function* checkedWith() {
      const stub = env.MONITOR.get(env.MONITOR.idFromName(`probe-${outcome}`));
      yield* Effect.promise(() => env.EMAIL.taken());
      yield* Effect.promise(() =>
        runInDurableObject(stub, (_instance, state) => state.storage.put("outcome", outcome)),
      );
      const response = yield* Effect.promise(() =>
        stub.fetch("https://monitor.internal/check", { method: "POST" }),
      );
      return {
        body: yield* Effect.promise(() => response.json()),
        mail: (yield* Effect.promise(() => env.EMAIL.taken())).map(({ subject, text }) => ({
          subject,
          text,
        })),
        status: response.status,
      };
    }),
  );

describe("a monitor check", () => {
  const it = test
    .extend("succeeded", () => checkedWith("succeed"))
    .extend("notified", () => checkedWith("notify"))
    .extend("failed", () => checkedWith("fail"))
    .extend("defected", () => checkedWith("die"));

  it("reports the checked outcome without mail when the check succeeds", ({ succeeded }) => {
    expect(succeeded).toStrictEqual({
      body: { ok: true, outcome: "succeed" },
      mail: [],
      status: 200,
    });
  });

  it("delivers the alert raised by the check and still succeeds", ({ notified }) => {
    expect(notified).toStrictEqual({
      body: { ok: true, outcome: "notify" },
      mail: [probeAlert],
      status: 200,
    });
  });

  it("names the declared failure and mails the failure notice", ({ failed }) => {
    expect(failed).toStrictEqual({
      body: { ok: false, reason: "MonitorFailure.alert_config_invalid" },
      mail: [probeFailure],
      status: 500,
    });
  });

  it("hides the defect reason and mails the failure notice", ({ defected }) => {
    expect(defected).toStrictEqual({
      body: { ok: false, reason: "unrecognized" },
      mail: [probeFailure],
      status: 500,
    });
  });
});
