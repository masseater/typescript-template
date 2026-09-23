import { describe, expect, test } from "vite-plus/test";

import { decideHealthAlerts, formatHealthMessage } from "./decision.ts";

import type { ProbeResult } from "./probe.ts";

const healthy: ProbeResult = { detail: "release_abc", healthy: true, service: "service-member" };
const down: ProbeResult = { detail: "status_500", healthy: false, service: "service-member" };

describe("first check", () => {
  const it = test.extend("healthDecision", () =>
    decideHealthAlerts(
      [down, { detail: "release_abc", healthy: true, service: "internal-dashboard" }],
      {},
    ));

  it("notifies about applications that are down", ({ healthDecision }) => {
    expect(healthDecision).toStrictEqual({
      notifications: [down],
      state: { "internal-dashboard": true, "service-member": false },
    });
  });
});

describe("ongoing outage", () => {
  const it = test.extend("healthDecision", () =>
    decideHealthAlerts([down], { "service-member": false }));

  it("stays quiet", ({ healthDecision }) => {
    expect(healthDecision).toStrictEqual({
      notifications: [],
      state: { "service-member": false },
    });
  });
});

describe("recovery", () => {
  const it = test.extend("healthDecision", () =>
    decideHealthAlerts([healthy], { "service-member": false }));

  it("notifies so the operator learns the outage ended", ({ healthDecision }) => {
    expect(healthDecision).toStrictEqual({
      notifications: [healthy],
      state: { "service-member": true },
    });
  });
});

describe("alert message", () => {
  const it = test.extend("alertMessage", () =>
    formatHealthMessage([down, { ...healthy, service: "internal-dashboard" }]));

  it("names every changed application and points at the log event", ({ alertMessage }) => {
    expect(alertMessage).toStrictEqual(
      [
        "- [停止] service-member (status_500)",
        "- [復旧] internal-dashboard (release_abc)",
        "Workers Observability で health_monitor.checked のログを確認してください。",
      ].join("\n"),
    );
  });
});
