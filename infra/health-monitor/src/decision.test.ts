import { decideHealthAlerts, formatHealthMessage } from "./decision.ts";
import { describe, expect, it } from "vite-plus/test";
import type { ProbeResult } from "./probe.ts";

const healthy: ProbeResult = { detail: "release_abc", healthy: true, service: "user" };
const down: ProbeResult = { detail: "status_500", healthy: false, service: "user" };

describe("health alerts", () => {
  it("a first check notifies about applications that are down and stays quiet about the rest", () => {
    expect.hasAssertions();
    const decision = decideHealthAlerts(
      [down, { detail: "release_abc", healthy: true, service: "wiki" }],
      {},
    );
    expect(decision.notifications).toStrictEqual([down]);
    expect(decision.state).toStrictEqual({ user: false, wiki: true });
  });

  it("an application that stays down is not notified again", () => {
    expect.hasAssertions();
    expect(decideHealthAlerts([down], { user: false }).notifications).toStrictEqual([]);
  });

  it("recovery is notified so the operator learns the outage ended", () => {
    expect.hasAssertions();
    const decision = decideHealthAlerts([healthy], { user: false });
    expect(decision.notifications).toStrictEqual([healthy]);
    expect(decision.state).toStrictEqual({ user: true });
  });

  it("the message names every changed application and points at the log event", () => {
    expect.hasAssertions();
    expect(formatHealthMessage([down, { ...healthy, service: "wiki" }])).toBe(
      [
        "- [停止] user (status_500)",
        "- [復旧] wiki (release_abc)",
        "Workers Observability で health_monitor.checked のログを確認してください。",
      ].join("\n"),
    );
  });
});
