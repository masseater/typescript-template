import { describe, expect, test } from "vite-plus/test";

import { decideHealthAlerts, formatHealthMessage } from "./decision.ts";

const healthy = { detail: "release_abc", healthy: true, service: "service-member" } as const;
const down = { detail: "status_500", healthy: false, service: "service-member" } as const;

describe("first check", () => {
  const it = test.extend("healthDecision", () =>
    decideHealthAlerts(
      [down, { detail: "release_abc", healthy: true, service: "internal-dashboard" }],
      {},
    ),
  );

  it("notifies about applications that are down", ({ healthDecision }) => {
    expect(healthDecision).toStrictEqual({
      healthByService: { "internal-dashboard": true, "service-member": false },
      notifications: [down],
    });
  });
});

describe("ongoing outage", () => {
  const it = test.extend("healthDecision", () =>
    decideHealthAlerts([down], { "service-member": false }),
  );

  it("stays quiet", ({ healthDecision }) => {
    expect(healthDecision).toStrictEqual({
      healthByService: { "service-member": false },
      notifications: [],
    });
  });
});

describe("recovery", () => {
  const it = test.extend("healthDecision", () =>
    decideHealthAlerts([healthy], { "service-member": false }),
  );

  it("notifies so the operator learns the outage ended", ({ healthDecision }) => {
    expect(healthDecision).toStrictEqual({
      healthByService: { "service-member": true },
      notifications: [healthy],
    });
  });
});

describe("alert message", () => {
  const it = test.extend("alertText", () =>
    formatHealthMessage([down, { ...healthy, service: "internal-dashboard" }]),
  );

  it("names every changed application and points at the log event", ({ alertText }) => {
    expect(alertText).toBe(
      [
        "- [停止] service-member (status_500)",
        "- [復旧] internal-dashboard (release_abc)",
        "Workers Observability で health_monitor.checked のログを確認してください。",
      ].join("\n"),
    );
  });
});
