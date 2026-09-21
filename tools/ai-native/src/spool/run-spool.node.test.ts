import { standardIoTest } from "@repo/dont-review-it";
import { DateTime, Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import { joinPath, readFileString, removePath } from "../host.ts";
import { runSpool } from "./run-spool.ts";

const nodeFs = process.getBuiltinModule("fs") as {
  readonly mkdtempSync: (prefix: string) => string;
};
const nodeOs = process.getBuiltinModule("os") as {
  readonly tmpdir: () => string;
};

const NODE = process.execPath;

const SEAM_INSTANT = "2026-08-11T12:00:00Z";

const SEAM_SUFFIX = "cafe0123";

const SEAMED_LOG_NAME = "20260811T120000Z-node--e-cafe0123.log";

const TEST_ROOT = nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "run-spool-volume-"));

const FIVE_THOUSAND_LINES_SCRIPT = 'for (let i = 0; i < 5000; i += 1) console.log("line " + i);';

const FIVE_THOUSAND_LINES_COMMAND_LINE = [NODE, "-e", FIVE_THOUSAND_LINES_SCRIPT].join(" ");

const FIVE_THOUSAND_LINES_BODY = Array.from(
  { length: 5000 },
  (_, lineIndex) => `line ${lineIndex}\n`,
).join("");

const FIVE_THOUSAND_LINES_ROOT = joinPath(TEST_ROOT, "five-thousand-lines");

const TEN_THOUSAND_LINES_SCRIPT =
  'const line = "x".repeat(99) + "\\n"; for (let i = 0; i < 10000; i += 1) process.stdout.write(line);';

const TEN_THOUSAND_LINES_COMMAND_LINE = [NODE, "-e", TEN_THOUSAND_LINES_SCRIPT].join(" ");

const TEN_THOUSAND_LINES_ROOT = joinPath(TEST_ROOT, "ten-thousand-lines");

const HUNDRED_THOUSAND_LINES_SCRIPT =
  'const line = "x".repeat(99) + "\\n"; for (let i = 0; i < 100000; i += 1) process.stdout.write(line);';

const HUNDRED_THOUSAND_LINES_COMMAND_LINE = [NODE, "-e", HUNDRED_THOUSAND_LINES_SCRIPT].join(" ");

const HUNDRED_THOUSAND_LINES_ROOT = joinPath(TEST_ROOT, "hundred-thousand-lines");

describe("runSpool", () => {
  describe("an argv naming no command at all", () => {
    const it = standardIoTest.extend("theCodeOfAnEmptyArgv", { auto: true }, () =>
      runSpool([], { stdout: process.stdout, stderr: process.stderr }),
    );

    it("is refused with the code kept for usage errors", ({ theCodeOfAnEmptyArgv }) => {
      expect(theCodeOfAnEmptyArgv).toBe(2);
    });

    it("leaves standard output untouched", ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [],
        }
      `);
    });

    it("puts the usage on standard error", ({ stderr }) => {
      expect(stderr).toMatchInlineSnapshot(`
        {
          "chunks": [
            "usage: spool -- <command> [args...]

        Runs the command with its stdout and stderr recorded to a single log file
        under the repository's .spool directory, and prints a fixed-size summary
        instead of the output. Terminal escape sequences are removed from the record.
        On a non-zero exit the summary is followed by the last 20 recorded lines.
        When the CI environment variable is set to a non-empty value other than "false",
        the command's stdio passes through untouched and no log file is created.

        exit codes: the command's own code (128+signal when killed by a signal),
        127 when the command cannot start, 1 when recording fails, 2 on usage errors
        ",
          ],
        }
      `);
    });
  });

  describe("a command printing five thousand lines", () => {
    const it = standardIoTest
      .extend("theCodeOfFiveThousandLines", ({}, { onCleanup }) => {
        removePath(FIVE_THOUSAND_LINES_ROOT);
        onCleanup(() => {
          removePath(FIVE_THOUSAND_LINES_ROOT);
        });
        return runSpool(["--", NODE, "-e", FIVE_THOUSAND_LINES_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => FIVE_THOUSAND_LINES_ROOT,
        });
      })
      .extend("theSummaryOfFiveThousandLines", ({ stdout }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(FIVE_THOUSAND_LINES_ROOT);
            onCleanup(() => {
              removePath(FIVE_THOUSAND_LINES_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", FIVE_THOUSAND_LINES_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => FIVE_THOUSAND_LINES_ROOT,
              }),
            );
            return stdout.text();
          }),
        ),
      )
      .extend("theStderrOfFiveThousandLines", ({ stderr }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(FIVE_THOUSAND_LINES_ROOT);
            onCleanup(() => {
              removePath(FIVE_THOUSAND_LINES_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", FIVE_THOUSAND_LINES_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => FIVE_THOUSAND_LINES_ROOT,
              }),
            );
            return stderr.text();
          }),
        ),
      )
      .extend("theRecordOfFiveThousandLines", ({}, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(FIVE_THOUSAND_LINES_ROOT);
            onCleanup(() => {
              removePath(FIVE_THOUSAND_LINES_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", FIVE_THOUSAND_LINES_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => FIVE_THOUSAND_LINES_ROOT,
              }),
            );
            return readFileString(joinPath(FIVE_THOUSAND_LINES_ROOT, SEAMED_LOG_NAME), "utf8");
          }),
        ),
      );

    it(
      "carries the code of the command it wrapped",
      { timeout: 15_000 },
      ({ theCodeOfFiveThousandLines }) => {
        expect(theCodeOfFiveThousandLines).toBe(0);
      },
    );

    it(
      "stands three lines tall and counts every byte and line",
      { timeout: 15_000 },
      ({ theSummaryOfFiveThousandLines }) => {
        expect(theSummaryOfFiveThousandLines).toBe(
          `spool: command: ${FIVE_THOUSAND_LINES_COMMAND_LINE}\nspool: log: ${joinPath(FIVE_THOUSAND_LINES_ROOT, SEAMED_LOG_NAME)} (${FIVE_THOUSAND_LINES_BODY.length} bytes, 5000 lines)\nspool: exit: 0 (0.0s)\n`,
        );
      },
    );

    it(
      "leaves standard error untouched",
      { timeout: 15_000 },
      ({ theStderrOfFiveThousandLines }) => {
        expect(theStderrOfFiveThousandLines).toBe("");
      },
    );

    it(
      "records the command and every line in order",
      { timeout: 15_000 },
      ({ theRecordOfFiveThousandLines }) => {
        expect(theRecordOfFiveThousandLines).toBe(
          `${FIVE_THOUSAND_LINES_COMMAND_LINE}\n\n${FIVE_THOUSAND_LINES_BODY}`,
        );
      },
    );
  });

  describe("a command printing ten thousand lines of a hundred bytes", () => {
    const it = standardIoTest
      .extend("theCodeOfTenThousandLines", ({}, { onCleanup }) => {
        removePath(TEN_THOUSAND_LINES_ROOT);
        onCleanup(() => {
          removePath(TEN_THOUSAND_LINES_ROOT);
        });
        return runSpool(["--", NODE, "-e", TEN_THOUSAND_LINES_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => TEN_THOUSAND_LINES_ROOT,
        });
      })
      .extend("theSummaryOfTenThousandLines", ({ stdout }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(TEN_THOUSAND_LINES_ROOT);
            onCleanup(() => {
              removePath(TEN_THOUSAND_LINES_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", TEN_THOUSAND_LINES_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => TEN_THOUSAND_LINES_ROOT,
              }),
            );
            return stdout.text();
          }),
        ),
      )
      .extend("theRecordSizeOfTenThousandLines", ({}, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(TEN_THOUSAND_LINES_ROOT);
            onCleanup(() => {
              removePath(TEN_THOUSAND_LINES_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", TEN_THOUSAND_LINES_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => TEN_THOUSAND_LINES_ROOT,
              }),
            );
            return Buffer.byteLength(
              readFileString(joinPath(TEN_THOUSAND_LINES_ROOT, SEAMED_LOG_NAME)),
            );
          }),
        ),
      );

    it(
      "carries the code of the command it wrapped",
      { timeout: 30_000 },
      ({ theCodeOfTenThousandLines }) => {
        expect(theCodeOfTenThousandLines).toBe(0);
      },
    );

    it(
      "stands three lines tall whatever the volume",
      { timeout: 30_000 },
      ({ theSummaryOfTenThousandLines }) => {
        expect(theSummaryOfTenThousandLines).toBe(
          `spool: command: ${TEN_THOUSAND_LINES_COMMAND_LINE}\nspool: log: ${joinPath(TEN_THOUSAND_LINES_ROOT, SEAMED_LOG_NAME)} (1000000 bytes, 10000 lines)\nspool: exit: 0 (0.0s)\n`,
        );
      },
    );

    it(
      "keeps the whole output in the record",
      { timeout: 30_000 },
      ({ theRecordSizeOfTenThousandLines }) => {
        expect(theRecordSizeOfTenThousandLines).toBe(
          TEN_THOUSAND_LINES_COMMAND_LINE.length + 2 + 1_000_000,
        );
      },
    );
  });

  describe("a command printing a hundred thousand lines of a hundred bytes", () => {
    const it = standardIoTest
      .extend("theCodeOfHundredThousandLines", ({}, { onCleanup }) => {
        removePath(HUNDRED_THOUSAND_LINES_ROOT);
        onCleanup(() => {
          removePath(HUNDRED_THOUSAND_LINES_ROOT);
        });
        return runSpool(["--", NODE, "-e", HUNDRED_THOUSAND_LINES_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => HUNDRED_THOUSAND_LINES_ROOT,
        });
      })
      .extend("theSummaryOfHundredThousandLines", ({ stdout }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(HUNDRED_THOUSAND_LINES_ROOT);
            onCleanup(() => {
              removePath(HUNDRED_THOUSAND_LINES_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", HUNDRED_THOUSAND_LINES_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => HUNDRED_THOUSAND_LINES_ROOT,
              }),
            );
            return stdout.text();
          }),
        ),
      )
      .extend("theRecordSizeOfHundredThousandLines", ({}, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(HUNDRED_THOUSAND_LINES_ROOT);
            onCleanup(() => {
              removePath(HUNDRED_THOUSAND_LINES_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", HUNDRED_THOUSAND_LINES_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => HUNDRED_THOUSAND_LINES_ROOT,
              }),
            );
            return Buffer.byteLength(
              readFileString(joinPath(HUNDRED_THOUSAND_LINES_ROOT, SEAMED_LOG_NAME)),
            );
          }),
        ),
      );

    it(
      "carries the code of the command it wrapped",
      { timeout: 30_000 },
      ({ theCodeOfHundredThousandLines }) => {
        expect(theCodeOfHundredThousandLines).toBe(0);
      },
    );

    it(
      "stands three lines tall whatever the volume",
      { timeout: 30_000 },
      ({ theSummaryOfHundredThousandLines }) => {
        expect(theSummaryOfHundredThousandLines).toBe(
          `spool: command: ${HUNDRED_THOUSAND_LINES_COMMAND_LINE}\nspool: log: ${joinPath(HUNDRED_THOUSAND_LINES_ROOT, SEAMED_LOG_NAME)} (10000000 bytes, 100000 lines)\nspool: exit: 0 (0.0s)\n`,
        );
      },
    );

    it(
      "keeps the whole output in the record",
      { timeout: 30_000 },
      ({ theRecordSizeOfHundredThousandLines }) => {
        expect(theRecordSizeOfHundredThousandLines).toBe(
          HUNDRED_THOUSAND_LINES_COMMAND_LINE.length + 2 + 10_000_000,
        );
      },
    );
  });
});
