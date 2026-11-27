import { expect, test } from "vite-plus/test";

import { NO_DURATIONS, chosenKey } from "./durations.ts";

const MAIN = "refs/heads/main";
const STARTED_AT = Date.parse("2026-11-27T08:44:43Z");

interface Listed {
  readonly key: string;
  readonly ref: string;
  readonly created_at: string;
}

const cache = (key: string, ref: string, createdAt: string): Listed => ({
  key,
  ref,
  created_at: createdAt,
});

const refs = new Set([MAIN]);

test("skips durations saved after the attempt started, so shards that start later read the same ones", () => {
  const listed = [
    cache("verify-durations-2-1", MAIN, "2026-11-27T08:47:00Z"),
    cache("verify-durations-1-1", MAIN, "2026-11-27T08:30:00Z"),
  ];
  expect(chosenKey({ listed, refs, startedAt: STARTED_AT })).toBe("verify-durations-1-1");
});

test("takes the newest durations of the refs the run can restore from", () => {
  const listed = [
    cache("verify-durations-3-1", "refs/heads/other", "2026-11-27T08:40:00Z"),
    cache("verify-durations-1-1", MAIN, "2026-11-27T08:10:00Z"),
    cache("verify-durations-2-1", MAIN, "2026-11-27T08:20:00Z"),
  ];
  expect(chosenKey({ listed, refs, startedAt: STARTED_AT })).toBe("verify-durations-2-1");
});

test("names no cache when none was saved before the attempt started", () => {
  const listed = [cache("verify-durations-2-1", MAIN, "2026-11-27T08:50:00Z")];
  expect(chosenKey({ listed, refs, startedAt: STARTED_AT })).toBe(NO_DURATIONS);
});
