import { expect, test } from "vite-plus/test";
import { decideHealthAlerts, formatHealthMessage } from "./decision.ts";
import type { ProbeResult } from "./probe.ts";

const healthy: ProbeResult = { service: "user", healthy: true, detail: "release_abc" };
const down: ProbeResult = { service: "user", healthy: false, detail: "status_500" };

test("a first check notifies about applications that are down and stays quiet about the rest", () => {
  const decision = decideHealthAlerts(
    [down, { service: "wiki", healthy: true, detail: "release_abc" }],
    {},
  );
  expect(decision.notifications).toEqual([down]);
  expect(decision.state).toEqual({ user: false, wiki: true });
});

test("an application that stays down is not notified again", () => {
  expect(decideHealthAlerts([down], { user: false }).notifications).toEqual([]);
});

test("recovery is notified so the operator learns the outage ended", () => {
  const decision = decideHealthAlerts([healthy], { user: false });
  expect(decision.notifications).toEqual([healthy]);
  expect(decision.state).toEqual({ user: true });
});

test("the message names every changed application and points at the log event", () => {
  expect(formatHealthMessage([down, { ...healthy, service: "wiki" }])).toBe(
    [
      "- [停止] user (status_500)",
      "- [復旧] wiki (release_abc)",
      "Workers Observability で health_monitor.checked のログを確認してください。",
    ].join("\n"),
  );
});
