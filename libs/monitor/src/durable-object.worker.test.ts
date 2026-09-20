import { listDurableObjectIds, reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vite-plus/test";

import handler, { ProbeMonitor, probeAlert, probeEvent, probeFailure } from "./monitor-fixture.ts";

import type { Outcome, SentMail } from "./monitor-fixture.ts";

const isoDayLength = "0000-00-00".length;
const checkFailed = 500;
const notFound = 404;
const ok = 200;
const monitor = env.MONITOR;

function stub(): DurableObjectStub {
  return monitor.get(monitor.idFromName(probeEvent));
}

function mailed(alert: { readonly subject: string; readonly text: string }): SentMail {
  return { ...alert, from: env.ALERT_FROM, to: env.ALERT_TO.split(",") };
}

async function seed(outcome: Outcome): Promise<void> {
  await reset();
  await runInDurableObject(stub(), async (_instance, state) =>
    state.storage.put("outcome", outcome),
  );
  await env.EMAIL.taken();
}

async function stored<Value>(key: string): Promise<Value | undefined> {
  return runInDurableObject(stub(), async (_instance, state) => state.storage.get<Value>(key));
}

async function check(): Promise<number> {
  const response = await stub().fetch("https://monitor.internal/check", { method: "POST" });
  return response.status;
}

async function checkReason(): Promise<unknown> {
  const response = await stub().fetch("https://monitor.internal/check", { method: "POST" });
  return response.json();
}

function today(): string {
  return new Date().toISOString().slice(0, isoDayLength);
}

describe("a monitor check running inside its durable object", () => {
  it("keeps what the check stored and answers with the result of the check", async () => {
    expect.hasAssertions();
    await seed("succeed");
    await expect(check()).resolves.toBe(ok);
    await expect(stored("outcome")).resolves.toBe("succeed");
    await expect(listDurableObjectIds(monitor)).resolves.toHaveLength(1);
  });

  it("alerts the operators once for a failing day and records the day it alerted", async () => {
    expect.hasAssertions();
    await seed("fail");
    await expect(check()).resolves.toBe(checkFailed);
    await expect(env.EMAIL.taken()).resolves.toStrictEqual([mailed(probeFailure)]);
    await expect(stored("failureNotifiedDay")).resolves.toBe(today());

    await expect(check()).resolves.toBe(checkFailed);
    await expect(env.EMAIL.taken()).resolves.toStrictEqual([]);
  });

  it("names the failure the check declared so the alert can be traced to it", async () => {
    expect.hasAssertions();
    await seed("fail");
    await expect(checkReason()).resolves.toStrictEqual({
      ok: false,
      reason: "MonitorFailure.alert_config_invalid",
    });
  });

  it("reports a failure the check never declared as unrecognized", async () => {
    expect.hasAssertions();
    await seed("die");
    await expect(checkReason()).resolves.toStrictEqual({ ok: false, reason: "unrecognized" });
  });

  it("alerts again once a successful check has cleared the day it alerted", async () => {
    expect.hasAssertions();
    await seed("fail");
    await expect(check()).resolves.toBe(checkFailed);
    await env.EMAIL.taken();

    await seed("succeed");
    await expect(check()).resolves.toBe(ok);
    await expect(stored("failureNotifiedDay")).resolves.toBeUndefined();
  });

  it("passes the alerts a check raises straight to the operators", async () => {
    expect.hasAssertions();
    await seed("notify");
    await expect(check()).resolves.toBe(ok);
    await expect(env.EMAIL.taken()).resolves.toStrictEqual([mailed(probeAlert)]);
    await expect(stored("failureNotifiedDay")).resolves.toBeUndefined();
  });
});

describe("the worker in front of the monitor durable object", () => {
  it("exports the class name the durable object binding asks for", () => {
    expect.hasAssertions();
    expect(ProbeMonitor.name).toBe("ProbeMonitor");
  });

  it("answers anything other than the scheduled check with 404", () => {
    expect.hasAssertions();
    expect(handler.fetch().status).toBe(notFound);
  });

  it("runs the check inside the durable object when the schedule fires", async () => {
    expect.hasAssertions();
    await seed("notify");
    await handler.scheduled(undefined, env);
    await expect(env.EMAIL.taken()).resolves.toStrictEqual([mailed(probeAlert)]);
  });

  it("fails the schedule when the durable object reports a failed check", async () => {
    expect.hasAssertions();
    await seed("fail");
    await expect(handler.scheduled(undefined, env)).rejects.toThrow(
      `${probeEvent}_schedule_failed`,
    );
    await expect(stored("failureNotifiedDay")).resolves.toBe(today());
  });
});
