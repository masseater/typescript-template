import { describe, expect, it } from "vite-plus/test";

import { decideHealthAlerts, formatHealthMessage } from "./decision.ts";

import type { ProbeResult } from "./probe.ts";

const healthy: ProbeResult = { detail: "release_abc", healthy: true, service: "service-member" };
const down: ProbeResult = { detail: "status_500", healthy: false, service: "service-member" };

describe("health alerts", () => {
  it("a first check notifies about applications that are down and stays quiet about the rest", () => {
    expect.hasAssertions();
    const decision = decideHealthAlerts(
      [down, { detail: "release_abc", healthy: true, service: "internal-dashboard" }],
      {},
    );
    expect(decision.notifications).toStrictEqual([down]);
    expect(decision.state).toStrictEqual({ "internal-dashboard": true, "service-member": false });
  });

  it("an application that stays down is not notified again", () => {
    expect.hasAssertions();
    expect(decideHealthAlerts([down], { "service-member": false }).notifications).toStrictEqual([]);
  });

  it("recovery is notified so the operator learns the outage ended", () => {
    expect.hasAssertions();
    const decision = decideHealthAlerts([healthy], { "service-member": false });
    expect(decision.notifications).toStrictEqual([healthy]);
    expect(decision.state).toStrictEqual({ "service-member": true });
  });

  it("the message names every changed application and points at the log event", () => {
    expect.hasAssertions();
    expect(formatHealthMessage([down, { ...healthy, service: "internal-dashboard" }])).toBe(
      [
        "- [停止] service-member (status_500)",
        "- [復旧] internal-dashboard (release_abc)",
        "Workers Observability で health_monitor.checked のログを確認してください。",
      ].join("\n"),
    );
  });
});
