import { describe, expect, it } from "vite-plus/test";

import { decideNotifications, formatMessage } from "./decision.ts";

import type { ErrorGroup } from "./telemetry.ts";

const now = Date.parse("2026-09-17T12:00:00Z");
const hour = 3_600_000;
const hoursPerDay = 24;
const daysBeforeForgotten = 8;
const recentHours = 2;
const occurrences = 3;

function group(fingerprint: string): ErrorGroup {
  return {
    count: occurrences,
    event: "browser.error",
    fingerprint,
    service: "service-member-browser",
    tag: "TypeError",
    type: "Error",
  };
}

describe("error notifications", () => {
  it("notifies new fingerprints and fingerprints silent for a day, but not ongoing ones", () => {
    expect.hasAssertions();
    const decision = decideNotifications(
      [group("0000000a"), group("0000000b"), group("0000000c")],
      {
        "0000000b": now - hour,
        "0000000c": now - (hoursPerDay + 1) * hour,
        "0000000d": now - daysBeforeForgotten * hoursPerDay * hour,
      },
      now,
    );
    expect(decision.notifications.map((item) => [item.fingerprint, item.reason])).toStrictEqual([
      ["0000000a", "new"],
      ["0000000c", "regressed"],
    ]);
    expect(decision.seen).toStrictEqual({ "0000000a": now, "0000000b": now, "0000000c": now });
  });

  it("keeps recently seen fingerprints that are absent from the current window", () => {
    expect.hasAssertions();
    const recent = now - recentHours * hour;
    const decision = decideNotifications([], { "0000000b": recent }, now);
    expect(decision.notifications).toStrictEqual([]);
    expect(decision.seen).toStrictEqual({ "0000000b": recent });
  });

  it("names each group so it can be searched in Workers Observability", () => {
    expect.hasAssertions();
    const message = formatMessage(decideNotifications([group("0000000a")], {}, now).notifications);
    expect(message).toContain(
      "[新規] service-member-browser browser.error TypeError Error (fingerprint 0000000a, 3 件)",
    );
    expect(message).toContain("error.fingerprint");
  });

  it("marks a group value the query did not return instead of naming a plausible one", () => {
    expect.hasAssertions();
    const message = formatMessage(
      decideNotifications(
        [
          {
            ...group("0000000a"),
            event: undefined,
            service: undefined,
            tag: undefined,
            type: undefined,
          },
        ],
        { "0000000a": now - (hoursPerDay + 1) * hour },
        now,
      ).notifications,
    );
    expect(message).toContain(
      "[再発] (値なし) (値なし) (値なし) (値なし) (fingerprint 0000000a, 3 件)",
    );
  });
});
