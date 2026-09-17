import { expect, test } from "vite-plus/test";
import { decideNotifications, formatMessage } from "./decision.ts";

const now = Date.parse("2026-09-17T12:00:00Z");
const hour = 60 * 60 * 1000;
const group = (fingerprint: string) => ({
  fingerprint,
  service: "user-browser",
  event: "browser.error",
  type: "TypeError",
  count: 3,
});

test("notifies new fingerprints and fingerprints silent for a day, but not ongoing ones", () => {
  const decision = decideNotifications(
    [group("0000000a"), group("0000000b"), group("0000000c")],
    { "0000000b": now - hour, "0000000c": now - 25 * hour, "0000000d": now - 8 * 24 * hour },
    now,
  );
  expect(decision.notifications.map((item) => [item.fingerprint, item.reason])).toEqual([
    ["0000000a", "new"],
    ["0000000c", "regressed"],
  ]);
  expect(decision.seen).toEqual({ "0000000a": now, "0000000b": now, "0000000c": now });
});

test("keeps recently seen fingerprints that are absent from the current window", () => {
  const decision = decideNotifications([], { "0000000b": now - 2 * hour }, now);
  expect(decision.notifications).toEqual([]);
  expect(decision.seen).toEqual({ "0000000b": now - 2 * hour });
});

test("the message names each group so it can be searched in Workers Observability", () => {
  const message = formatMessage(decideNotifications([group("0000000a")], {}, now).notifications);
  expect(message).toContain(
    "[新規] user-browser browser.error TypeError (fingerprint 0000000a, 3 件)",
  );
  expect(message).toContain("error.fingerprint");
});
