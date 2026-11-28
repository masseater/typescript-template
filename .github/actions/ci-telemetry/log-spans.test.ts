import { expect, test } from "vite-plus/test";

import { spansOfLog } from "./log-spans.ts";

const NANOS_PER_MILLI = 1_000_000n;
const STEP_START = 0n;
const STEP_END = 99_999_999_999_999_999_999n;
const steps = [{ name: "verify", conclusion: "success", start: STEP_START, end: STEP_END }];

const instant = (second: string): bigint =>
  BigInt(Date.parse(`2026-11-28T02:59:${second}Z`)) * NANOS_PER_MILLI;

const stamped = (second: string, body: string): string =>
  `2026-11-28T02:59:${second}.0000000Z ${body}`;

test("closes a vp task at the line that heads its output and keeps its cache status", () => {
  const log = [
    stamped("05", "[app#check] ~/app$ vp check ○ cache miss: no previous cache entry, executing"),
    stamped("35", "── [app#check] ──"),
  ].join("\n");
  expect(spansOfLog("job", steps, log)).toMatchObject([
    {
      name: "app#check",
      start: instant("05"),
      end: instant("35"),
      attributes: { "vp.task.cache": "cache miss" },
    },
  ]);
});

test("records a step inside a composite action", () => {
  const log = [
    stamped("01", "##[start-action display=Run%20setup;id=__self.__run]"),
    stamped(
      "21",
      "##[end-action id=__self.__run;outcome=success;conclusion=success;duration_ms=1]",
    ),
  ].join("\n");
  expect(spansOfLog("job", steps, log)).toMatchObject([
    { name: "Run setup", start: instant("01"), end: instant("21") },
  ]);
});
