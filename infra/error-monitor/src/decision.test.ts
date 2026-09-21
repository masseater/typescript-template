import { describe, expect, test } from "vite-plus/test";

import { decideNotifications, formatMessage } from "./decision.ts";

const observedAtMs = Date.parse("2026-09-17T12:00:00Z");
const hour = 3_600_000;
const hoursPerDay = 24;
const daysBeforeForgotten = 8;
const recentHours = 2;
const occurrences = 3;

const fingerprinted = {
  count: occurrences,
  event: "browser.error",
  fingerprint: "0000000a",
  service: "service-member-browser",
  tag: "TypeError",
  type: "Error",
} as const;

describe("new and regressed fingerprints", () => {
  const it = test.extend("notificationDecision", () =>
    decideNotifications({
      errorGroups: [
        fingerprinted,
        { ...fingerprinted, fingerprint: "0000000b" },
        { ...fingerprinted, fingerprint: "0000000c" },
      ],
      observedAtMs,
      seenFingerprints: {
        "0000000b": observedAtMs - hour,
        "0000000c": observedAtMs - (hoursPerDay + 1) * hour,
        "0000000d": observedAtMs - daysBeforeForgotten * hoursPerDay * hour,
      },
    }),
  );

  it("notifies new fingerprints and fingerprints silent for a day", ({ notificationDecision }) => {
    expect(notificationDecision).toStrictEqual({
      notifications: [
        { ...fingerprinted, reason: "new" },
        { ...fingerprinted, fingerprint: "0000000c", reason: "regressed" },
      ],
      seen: { "0000000a": observedAtMs, "0000000b": observedAtMs, "0000000c": observedAtMs },
    });
  });
});

describe("recent fingerprints absent from the window", () => {
  const recent = observedAtMs - recentHours * hour;
  const it = test.extend("notificationDecision", () =>
    decideNotifications({
      errorGroups: [],
      observedAtMs,
      seenFingerprints: { "0000000b": recent },
    }),
  );

  it("keeps them without notifying", ({ notificationDecision }) => {
    expect(notificationDecision).toStrictEqual({
      notifications: [],
      seen: { "0000000b": recent },
    });
  });
});

describe("notification message", () => {
  const it = test.extend("alertText", () =>
    formatMessage(
      decideNotifications({
        errorGroups: [fingerprinted],
        observedAtMs,
        seenFingerprints: {},
      }).notifications,
    ),
  );

  it("names each group for Workers Observability search", ({ alertText }) => {
    expect(alertText).toBe(
      [
        "Cloudflare Workers で 1 件のエラーを検出しました。",
        "- [新規] service-member-browser browser.error TypeError Error (fingerprint 0000000a, 3 件)",
        "Workers Observability で error.fingerprint を指定して検索してください。",
      ].join("\n"),
    );
  });
});

describe("missing group fields", () => {
  const it = test.extend("alertText", () =>
    formatMessage(
      decideNotifications({
        errorGroups: [
          {
            ...fingerprinted,
            event: undefined,
            service: undefined,
            tag: undefined,
            type: undefined,
          },
        ],
        observedAtMs,
        seenFingerprints: { "0000000a": observedAtMs - (hoursPerDay + 1) * hour },
      }).notifications,
    ),
  );

  it("marks absent values instead of inventing them", ({ alertText }) => {
    expect(alertText).toBe(
      [
        "Cloudflare Workers で 1 件のエラーを検出しました。",
        "- [再発] (値なし) (値なし) (値なし) (値なし) (fingerprint 0000000a, 3 件)",
        "Workers Observability で error.fingerprint を指定して検索してください。",
      ].join("\n"),
    );
  });
});
