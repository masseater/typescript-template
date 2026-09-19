import "@repo/dont-review-it/vitest/parsed-fields";
import { reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { attemptAsync } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { MonitorFailure } from "./failure.ts";
import probeHandler, {
  probeAlert,
  probeBehaviourKey,
  probeBehaviours,
  probeEvent,
  probeFailure,
} from "./monitor-fixture.ts";

const [failingBehaviour, notifyingBehaviour, succeedingBehaviour] = probeBehaviours;

const operators = {
  from: "monitor@example.test",
  to: ["operator@example.test", "oncall@example.test"],
};

describe("Monitor.runCheck", () => {
  describe("a check that succeeds", () => {
    const it = test.extend("checkResponse", async () => {
      await reset();
      const probeMonitor = env.MONITOR.get(env.MONITOR.idFromName(probeEvent));
      await runInDurableObject(probeMonitor, async (_monitor, monitorState) =>
        monitorState.storage.put(probeBehaviourKey, succeedingBehaviour),
      );
      return probeMonitor.runCheck();
    });

    it("answers 200 with what the check summarised", async ({ checkResponse }) => {
      await expect(checkResponse).toHaveParsedFields({
        status: 200,
        headers: { "content-type": "application/json" },
        body: { behaviour: succeedingBehaviour, ok: true },
      });
    });
  });

  describe("a check that fails", () => {
    const it = test.extend("checkResponse", async () => {
      await reset();
      const probeMonitor = env.MONITOR.get(env.MONITOR.idFromName(probeEvent));
      await runInDurableObject(probeMonitor, async (_monitor, monitorState) =>
        monitorState.storage.put(probeBehaviourKey, failingBehaviour),
      );
      return probeMonitor.runCheck();
    });

    it("answers 500 without saying why", async ({ checkResponse }) => {
      await expect(checkResponse).toHaveParsedFields({
        status: 500,
        headers: { "content-type": "application/json" },
        body: { ok: false },
      });
    });
  });

  describe("a check that fails twice on one day", () => {
    const it = test.extend("sentMail", async () => {
      await reset();
      const probeMonitor = env.MONITOR.get(env.MONITOR.idFromName(probeEvent));
      await runInDurableObject(probeMonitor, async (_monitor, monitorState) =>
        monitorState.storage.put(probeBehaviourKey, failingBehaviour),
      );
      await probeMonitor.runCheck();
      await probeMonitor.runCheck();
      const mailKeys = await env.SENT_MAIL.list();
      return Promise.all(
        mailKeys.keys.map(async (mailKey) => env.SENT_MAIL.get(mailKey.name, "json")),
      );
    });

    it("alerts the operators once", ({ sentMail }) => {
      expect(sentMail).toStrictEqual([{ ...operators, ...probeFailure }]);
    });
  });

  describe("a check that fails, as to the day it alerted", () => {
    const it = test.extend("failureNotifiedDay", async () => {
      await reset();
      const probeMonitor = env.MONITOR.get(env.MONITOR.idFromName(probeEvent));
      await runInDurableObject(probeMonitor, async (_monitor, monitorState) =>
        monitorState.storage.put(probeBehaviourKey, failingBehaviour),
      );
      await probeMonitor.runCheck();
      return runInDurableObject(probeMonitor, async (_monitor, monitorState) =>
        monitorState.storage.get("failureNotifiedDay"),
      );
    });

    it("records today as the day it alerted", ({ failureNotifiedDay }) => {
      expect(failureNotifiedDay).toBe(new Date().toISOString().slice(0, "0000-00-00".length));
    });
  });

  describe("a failed check followed by a successful one", () => {
    const it = test.extend("failureNotifiedDay", async () => {
      await reset();
      const probeMonitor = env.MONITOR.get(env.MONITOR.idFromName(probeEvent));
      await runInDurableObject(probeMonitor, async (_monitor, monitorState) =>
        monitorState.storage.put(probeBehaviourKey, failingBehaviour),
      );
      await probeMonitor.runCheck();
      await runInDurableObject(probeMonitor, async (_monitor, monitorState) =>
        monitorState.storage.put(probeBehaviourKey, succeedingBehaviour),
      );
      await probeMonitor.runCheck();
      return runInDurableObject(probeMonitor, async (_monitor, monitorState) =>
        monitorState.storage.get("failureNotifiedDay"),
      );
    });

    it("clears the day it alerted so the next failure alerts again", ({ failureNotifiedDay }) => {
      expect(failureNotifiedDay).toBe(undefined);
    });
  });

  describe("a check that raises an alert of its own", () => {
    const it = test.extend("sentMail", async () => {
      await reset();
      const probeMonitor = env.MONITOR.get(env.MONITOR.idFromName(probeEvent));
      await runInDurableObject(probeMonitor, async (_monitor, monitorState) =>
        monitorState.storage.put(probeBehaviourKey, notifyingBehaviour),
      );
      await probeMonitor.runCheck();
      const mailKeys = await env.SENT_MAIL.list();
      return Promise.all(
        mailKeys.keys.map(async (mailKey) => env.SENT_MAIL.get(mailKey.name, "json")),
      );
    });

    it("passes the alert straight to the operators", ({ sentMail }) => {
      expect(sentMail).toStrictEqual([{ ...operators, ...probeAlert }]);
    });
  });
});

describe("monitorHandler", () => {
  describe("a request to the worker in front of the monitor", () => {
    const it = test.extend("strayResponse", () => probeHandler.fetch());

    it("is answered with 404", async ({ strayResponse }) => {
      await expect(strayResponse).toHaveParsedFields({
        status: 404,
        headers: { "content-type": "text/plain;charset=UTF-8" },
        body: "Not found",
      });
    });
  });

  describe("the schedule firing for a check that raises an alert", () => {
    const it = test.extend("sentMail", async () => {
      await reset();
      const probeMonitor = env.MONITOR.get(env.MONITOR.idFromName(probeEvent));
      await runInDurableObject(probeMonitor, async (_monitor, monitorState) =>
        monitorState.storage.put(probeBehaviourKey, notifyingBehaviour),
      );
      await probeHandler.scheduled(undefined, env);
      const mailKeys = await env.SENT_MAIL.list();
      return Promise.all(
        mailKeys.keys.map(async (mailKey) => env.SENT_MAIL.get(mailKey.name, "json")),
      );
    });

    it("runs the check inside the durable object", ({ sentMail }) => {
      expect(sentMail).toStrictEqual([{ ...operators, ...probeAlert }]);
    });
  });

  describe("the schedule firing for a check that fails", () => {
    const it = test.extend("scheduleFailure", async () => {
      await reset();
      const probeMonitor = env.MONITOR.get(env.MONITOR.idFromName(probeEvent));
      await runInDurableObject(probeMonitor, async (_monitor, monitorState) =>
        monitorState.storage.put(probeBehaviourKey, failingBehaviour),
      );
      const [scheduleFailure] = await attemptAsync(async () =>
        probeHandler.scheduled(undefined, env),
      );
      return scheduleFailure;
    });

    it("fails the schedule", ({ scheduleFailure }) => {
      expect(scheduleFailure).toStrictEqual(new MonitorFailure({ code: "schedule_failed" }));
    });
  });
});
