import { standardIoTest } from "@repo/dont-review-it";
import { DateTime, Effect } from "effect";
import { describe, expect, vi } from "vite-plus/test";

import {
  baseName,
  fileExists,
  joinPath,
  makeDirectory,
  parentPath,
  readDirectory,
  readFileString,
  removePath,
  writeFileString,
} from "../host.ts";
import { spawnChildSync } from "../node-spawn.ts";
import { runSpool } from "./run-spool.ts";

const fileStreamApi = process.getBuiltinModule("fs") as {
  readonly createReadStream: (location: string) => {
    destroy: () => void;
    pipe: (destination: unknown, options?: { end?: boolean }) => unknown;
  };
  readonly mkdtempSync: (prefix: string) => string;
};
const nodeOs = process.getBuiltinModule("os") as {
  readonly tmpdir: () => string;
};
const streamApi = process.getBuiltinModule("stream") as {
  readonly PassThrough: new () => {
    end: () => void;
    on: (event: string, listener: (part: Buffer) => void) => unknown;
    pipe: (destination: unknown, options?: { end?: boolean }) => unknown;
    write: (part: string | Uint8Array) => boolean;
  };
};

class CapturedStream extends streamApi.PassThrough {
  private captured = "";

  constructor() {
    super();
    this.on("data", (part: Buffer) => {
      this.captured += String(part);
    });
  }

  text(): string {
    return this.captured;
  }
}

const NODE = process.execPath;

const SEAM_INSTANT = "2026-08-11T12:00:00Z";

const SEAM_SUFFIX = "cafe0123";

const SEAMED_LOG_NAME = "20260811T120000Z-node--e-cafe0123.log";

const TEST_ROOT = fileStreamApi.mkdtempSync(joinPath(nodeOs.tmpdir(), "run-spool-test-"));

const SILENT_SCRIPT = "";

const SILENT_COMMAND_LINE = [NODE, "-e", SILENT_SCRIPT].join(" ");

const SILENT_COMMAND_ROOT = joinPath(TEST_ROOT, "silent-command");

const ESCAPED_OUTPUT_SCRIPT = 'process.stdout.write("\\u001b[31mred\\u001b[0m plain\\n");';

const ESCAPED_OUTPUT_COMMAND_LINE = [NODE, "-e", ESCAPED_OUTPUT_SCRIPT].join(" ");

const ESCAPED_OUTPUT_ROOT = joinPath(TEST_ROOT, "escaped-output");

const INTERLEAVED_OUTPUT_SCRIPT = [
  "const delay = (ms) => new Promise((r) => setTimeout(r, ms));",
  '(async () => { console.log("out one"); await delay(200); console.error("err two"); await delay(200); console.log("out three"); })();',
].join(" ");

const INTERLEAVED_OUTPUT_COMMAND_LINE = [NODE, "-e", INTERLEAVED_OUTPUT_SCRIPT].join(" ");

const INTERLEAVED_OUTPUT_ROOT = joinPath(TEST_ROOT, "interleaved-output");

const DELAYED_MARK_SCRIPT =
  'console.log("first-" + "mark"); setTimeout(() => { console.log("second-" + "mark"); }, 700);';

const DELAYED_MARK_COMMAND_LINE = [NODE, "-e", DELAYED_MARK_SCRIPT].join(" ");

const DELAYED_MARK_ROOT = joinPath(TEST_ROOT, "delayed-mark");

const FAILING_SCRIPT = "process.exit(7)";

const FAILING_COMMAND_LINE = [NODE, "-e", FAILING_SCRIPT].join(" ");

const FAILING_ROOT = joinPath(TEST_ROOT, "failing-command");

const THIRTY_ROWS_SCRIPT =
  'for (let i = 1; i <= 30; i += 1) console.log("row " + i); process.exit(3);';

const THIRTY_ROWS_COMMAND_LINE = [NODE, "-e", THIRTY_ROWS_SCRIPT].join(" ");

const THIRTY_ROWS_BODY = Array.from({ length: 30 }, (_, rowIndex) => `row ${rowIndex + 1}\n`).join(
  "",
);

const THIRTY_ROWS_EXCERPT = Array.from(
  { length: 20 },
  (_, rowIndex) => `row ${rowIndex + 11}\n`,
).join("");

const THIRTY_ROWS_ROOT = joinPath(TEST_ROOT, "thirty-rows");

const PARTIAL_LINE_SCRIPT = 'process.stdout.write("partial oops"); process.exit(9);';

const PARTIAL_LINE_COMMAND_LINE = [NODE, "-e", PARTIAL_LINE_SCRIPT].join(" ");

const PARTIAL_LINE_ROOT = joinPath(TEST_ROOT, "partial-line");

const SELF_KILLING_SCRIPT =
  'process.stdout.write("before signal\\n", () => process.kill(process.pid, "SIGKILL"));';

const SELF_KILLING_COMMAND_LINE = [NODE, "-e", SELF_KILLING_SCRIPT].join(" ");

const SELF_KILLING_ROOT = joinPath(TEST_ROOT, "self-killing");

const MISSING_EXECUTABLE = "/nonexistent/never-here";

const MISSING_EXECUTABLE_ROOT = joinPath(TEST_ROOT, "missing-executable");

const BLOCKED_ROOT_PARENT = joinPath(TEST_ROOT, "blocked-root");

const BLOCKED_ROOT = joinPath(BLOCKED_ROOT_PARENT, "blocked");

const SENTINEL_PATH = joinPath(BLOCKED_ROOT_PARENT, "sentinel");

const SENTINEL_SCRIPT = 'require("node:fs").writeFileSync(process.argv[1], "ran");';

const SENTINEL_COMMAND_LINE = [NODE, "-e", SENTINEL_SCRIPT, SENTINEL_PATH].join(" ");

const FIFO_ROOT = joinPath(TEST_ROOT, "fifo-record");

const FIFO_GATE_DIRECTORY = joinPath(TEST_ROOT, "fifo-gate");

const FIFO_GATE = joinPath(FIFO_GATE_DIRECTORY, "gate");

const FIFO_MARKER = joinPath(FIFO_GATE_DIRECTORY, "marker");

const FIFO_SCRIPT = [
  'const fs = require("node:fs");',
  'process.stdout.write("phase one\\n");',
  "const gate = process.argv[1];",
  "const marker = process.argv[2];",
  "const poll = () => {",
  "  if (!fs.existsSync(gate)) { setTimeout(poll, 20); return; }",
  '  process.stdout.write("y".repeat(2097152), () => { fs.writeFileSync(marker, "done"); process.exit(0); });',
  "};",
  "poll();",
].join(" ");

const FIFO_COMMAND_LINE = [NODE, "-e", FIFO_SCRIPT, FIFO_GATE, FIFO_MARKER].join(" ");

const CONCURRENT_ROOT = joinPath(TEST_ROOT, "concurrent");

const PID_SCRIPT = "console.log(process.pid)";

const ELAPSED_SECONDS_ROOT = joinPath(TEST_ROOT, "elapsed-seconds");

const ELAPSED_SECONDS_SCRIPT = 'console.log("h")';

const ELAPSED_SECONDS_COMMAND_LINE = [NODE, "-e", ELAPSED_SECONDS_SCRIPT].join(" ");

const DEFAULT_RUN_SCRIPT = 'console.log("default run")';

const DEFAULT_RUN_COMMAND_LINE = [NODE, "-e", DEFAULT_RUN_SCRIPT].join(" ");

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

  describe("a command printing nothing at all", () => {
    const it = standardIoTest
      .extend("theCodeOfASilentCommand", ({}, { onCleanup }) => {
        removePath(SILENT_COMMAND_ROOT);
        onCleanup(() => {
          removePath(SILENT_COMMAND_ROOT);
        });
        return runSpool(["--", NODE, "-e", SILENT_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => SILENT_COMMAND_ROOT,
        });
      })
      .extend("theSummaryOfASilentCommand", ({ stdout }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(SILENT_COMMAND_ROOT);
            onCleanup(() => {
              removePath(SILENT_COMMAND_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", SILENT_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => SILENT_COMMAND_ROOT,
              }),
            );
            return stdout.text();
          }),
        ),
      );

    it("carries the code of the command it wrapped", ({ theCodeOfASilentCommand }) => {
      expect(theCodeOfASilentCommand).toBe(0);
    });

    it("counts no bytes and no lines", ({ theSummaryOfASilentCommand }) => {
      expect(theSummaryOfASilentCommand).toBe(
        `spool: command: ${SILENT_COMMAND_LINE}\nspool: log: ${joinPath(SILENT_COMMAND_ROOT, SEAMED_LOG_NAME)} (0 bytes, 0 lines)\nspool: exit: 0 (0.0s)\n`,
      );
    });
  });

  describe("a command colouring its output with escape sequences", () => {
    const it = standardIoTest.extend("theRunColouringItsOutput", ({}, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          removePath(ESCAPED_OUTPUT_ROOT);
          onCleanup(() => {
            removePath(ESCAPED_OUTPUT_ROOT);
          });
          yield* Effect.promise(() =>
            runSpool(["--", NODE, "-e", ESCAPED_OUTPUT_SCRIPT], {
              stdout: process.stdout,
              stderr: process.stderr,
              isPassthrough: () => false,
              now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
              uniqueSuffix: () => SEAM_SUFFIX,
              monotonicNow: () => 0,
              spoolRoot: () => ESCAPED_OUTPUT_ROOT,
            }),
          );
          return readFileString(joinPath(ESCAPED_OUTPUT_ROOT, SEAMED_LOG_NAME), "utf8");
        }),
      ),
    );

    it("keeps the visible characters and drops the escapes", ({ theRunColouringItsOutput }) => {
      expect(theRunColouringItsOutput).toBe(`${ESCAPED_OUTPUT_COMMAND_LINE}\n\nred plain\n`);
    });
  });

  describe("a command writing to both of its streams in turn", () => {
    const it = standardIoTest
      .extend("theCodeOfBothStreams", ({}, { onCleanup }) => {
        removePath(INTERLEAVED_OUTPUT_ROOT);
        onCleanup(() => {
          removePath(INTERLEAVED_OUTPUT_ROOT);
        });
        return runSpool(["--", NODE, "-e", INTERLEAVED_OUTPUT_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => INTERLEAVED_OUTPUT_ROOT,
        });
      })
      .extend("theRecordOfBothStreams", ({}, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(INTERLEAVED_OUTPUT_ROOT);
            onCleanup(() => {
              removePath(INTERLEAVED_OUTPUT_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", INTERLEAVED_OUTPUT_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => INTERLEAVED_OUTPUT_ROOT,
              }),
            );
            return readFileString(joinPath(INTERLEAVED_OUTPUT_ROOT, SEAMED_LOG_NAME), "utf8");
          }),
        ),
      );

    it(
      "carries the code of the command it wrapped",
      { timeout: 15_000 },
      ({ theCodeOfBothStreams }) => {
        expect(theCodeOfBothStreams).toBe(0);
      },
    );

    it(
      "joins both streams into one record in the order they were written",
      { timeout: 15_000 },
      ({ theRecordOfBothStreams }) => {
        expect(theRecordOfBothStreams).toBe(
          `${INTERLEAVED_OUTPUT_COMMAND_LINE}\n\nout one\nerr two\nout three\n`,
        );
      },
    );
  });

  describe("a command still running after its first line", () => {
    const it = standardIoTest
      .extend("theRecordSeenWhileStillGoing", ({}, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(DELAYED_MARK_ROOT);
            onCleanup(() => {
              removePath(DELAYED_MARK_ROOT);
            });
            const running = runSpool(["--", NODE, "-e", DELAYED_MARK_SCRIPT], {
              stdout: process.stdout,
              stderr: process.stderr,
              isPassthrough: () => false,
              now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
              uniqueSuffix: () => SEAM_SUFFIX,
              monotonicNow: () => 0,
              spoolRoot: () => DELAYED_MARK_ROOT,
            });
            const logPath = joinPath(DELAYED_MARK_ROOT, SEAMED_LOG_NAME);
            while (!fileExists(logPath) || !readFileString(logPath).includes("first-mark")) {
              yield* Effect.sleep("20 millis");
            }
            const observed = readFileString(logPath);
            yield* Effect.promise(() => running);
            return observed;
          }),
        ),
      )
      .extend("theOutcomeRacedWhileStillGoing", ({}, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(DELAYED_MARK_ROOT);
            onCleanup(() => {
              removePath(DELAYED_MARK_ROOT);
            });
            const running = runSpool(["--", NODE, "-e", DELAYED_MARK_SCRIPT], {
              stdout: process.stdout,
              stderr: process.stderr,
              isPassthrough: () => false,
              now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
              uniqueSuffix: () => SEAM_SUFFIX,
              monotonicNow: () => 0,
              spoolRoot: () => DELAYED_MARK_ROOT,
            });
            const logPath = joinPath(DELAYED_MARK_ROOT, SEAMED_LOG_NAME);
            while (!fileExists(logPath) || !readFileString(logPath).includes("first-mark")) {
              yield* Effect.sleep("20 millis");
            }
            const settled = yield* Effect.promise(() =>
              Promise.race([running, Promise.resolve("still recording")]),
            );
            yield* Effect.promise(() => running);
            return settled;
          }),
        ),
      )
      .extend("theCodeOfTheDelayedCommand", ({}, { onCleanup }) => {
        removePath(DELAYED_MARK_ROOT);
        onCleanup(() => {
          removePath(DELAYED_MARK_ROOT);
        });
        return runSpool(["--", NODE, "-e", DELAYED_MARK_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => DELAYED_MARK_ROOT,
        });
      })
      .extend("theRecordLeftByTheDelayedCommand", ({}, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(DELAYED_MARK_ROOT);
            onCleanup(() => {
              removePath(DELAYED_MARK_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", DELAYED_MARK_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => DELAYED_MARK_ROOT,
              }),
            );
            return readFileString(joinPath(DELAYED_MARK_ROOT, SEAMED_LOG_NAME), "utf8");
          }),
        ),
      );

    it(
      "shows the lines written so far and nothing later",
      { timeout: 15_000 },
      ({ theRecordSeenWhileStillGoing }) => {
        expect(theRecordSeenWhileStillGoing).toBe(`${DELAYED_MARK_COMMAND_LINE}\n\nfirst-mark\n`);
      },
    );

    it(
      "has not settled while the command is still going",
      { timeout: 15_000 },
      ({ theOutcomeRacedWhileStillGoing }) => {
        expect(theOutcomeRacedWhileStillGoing).toBe("still recording");
      },
    );

    it(
      "carries the code of the command it wrapped",
      { timeout: 15_000 },
      ({ theCodeOfTheDelayedCommand }) => {
        expect(theCodeOfTheDelayedCommand).toBe(0);
      },
    );

    it(
      "holds the later line once the command is done",
      { timeout: 15_000 },
      ({ theRecordLeftByTheDelayedCommand }) => {
        expect(theRecordLeftByTheDelayedCommand).toBe(
          `${DELAYED_MARK_COMMAND_LINE}\n\nfirst-mark\nsecond-mark\n`,
        );
      },
    );
  });

  describe("a command exiting with a code of its own", () => {
    const it = standardIoTest
      .extend("theCodeOfARunExitingWithSeven", ({}, { onCleanup }) => {
        removePath(FAILING_ROOT);
        onCleanup(() => {
          removePath(FAILING_ROOT);
        });
        return runSpool(["--", NODE, "-e", FAILING_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => FAILING_ROOT,
        });
      })
      .extend("theSummaryOfARunExitingWithSeven", ({ stdout }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(FAILING_ROOT);
            onCleanup(() => {
              removePath(FAILING_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", FAILING_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => FAILING_ROOT,
              }),
            );
            return stdout.text();
          }),
        ),
      )
      .extend("theStderrOfARunExitingWithSeven", ({ stderr }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(FAILING_ROOT);
            onCleanup(() => {
              removePath(FAILING_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", FAILING_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => FAILING_ROOT,
              }),
            );
            return stderr.text();
          }),
        ),
      );

    it("hands the code of the command back unchanged", ({ theCodeOfARunExitingWithSeven }) => {
      expect(theCodeOfARunExitingWithSeven).toBe(7);
    });

    it("names the code in the summary on standard output", ({
      theSummaryOfARunExitingWithSeven,
    }) => {
      expect(theSummaryOfARunExitingWithSeven).toBe(
        `spool: command: ${FAILING_COMMAND_LINE}\nspool: log: ${joinPath(FAILING_ROOT, SEAMED_LOG_NAME)} (0 bytes, 0 lines)\nspool: exit: 7 (0.0s)\n`,
      );
    });

    it("leaves standard error untouched", ({ theStderrOfARunExitingWithSeven }) => {
      expect(theStderrOfARunExitingWithSeven).toBe("");
    });
  });

  describe("a command printing thirty rows before failing", () => {
    const it = standardIoTest
      .extend("theCodeOfThirtyRows", ({}, { onCleanup }) => {
        removePath(THIRTY_ROWS_ROOT);
        onCleanup(() => {
          removePath(THIRTY_ROWS_ROOT);
        });
        return runSpool(["--", NODE, "-e", THIRTY_ROWS_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => THIRTY_ROWS_ROOT,
        });
      })
      .extend("theSummaryOfThirtyRows", ({ stdout }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(THIRTY_ROWS_ROOT);
            onCleanup(() => {
              removePath(THIRTY_ROWS_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", THIRTY_ROWS_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => THIRTY_ROWS_ROOT,
              }),
            );
            return stdout.text();
          }),
        ),
      );

    it("hands the code of the command back unchanged", ({ theCodeOfThirtyRows }) => {
      expect(theCodeOfThirtyRows).toBe(3);
    });

    it("follows the summary with the last twenty recorded rows", ({ theSummaryOfThirtyRows }) => {
      expect(theSummaryOfThirtyRows).toBe(
        `spool: command: ${THIRTY_ROWS_COMMAND_LINE}\nspool: log: ${joinPath(THIRTY_ROWS_ROOT, SEAMED_LOG_NAME)} (${THIRTY_ROWS_BODY.length} bytes, 30 lines)\nspool: exit: 3 (0.0s)\n${THIRTY_ROWS_EXCERPT}`,
      );
    });
  });

  describe("a command failing on a line it never closed", () => {
    const it = standardIoTest
      .extend("theCodeOfAnOpenLine", ({}, { onCleanup }) => {
        removePath(PARTIAL_LINE_ROOT);
        onCleanup(() => {
          removePath(PARTIAL_LINE_ROOT);
        });
        return runSpool(["--", NODE, "-e", PARTIAL_LINE_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => PARTIAL_LINE_ROOT,
        });
      })
      .extend("theSummaryOfAnOpenLine", ({ stdout }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(PARTIAL_LINE_ROOT);
            onCleanup(() => {
              removePath(PARTIAL_LINE_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", PARTIAL_LINE_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => PARTIAL_LINE_ROOT,
              }),
            );
            return stdout.text();
          }),
        ),
      );

    it("hands the code of the command back unchanged", ({ theCodeOfAnOpenLine }) => {
      expect(theCodeOfAnOpenLine).toBe(9);
    });

    it("counts the unclosed line and closes it in the excerpt", ({ theSummaryOfAnOpenLine }) => {
      expect(theSummaryOfAnOpenLine).toBe(
        `spool: command: ${PARTIAL_LINE_COMMAND_LINE}\nspool: log: ${joinPath(PARTIAL_LINE_ROOT, SEAMED_LOG_NAME)} (12 bytes, 1 lines)\nspool: exit: 9 (0.0s)\npartial oops\n`,
      );
    });
  });

  describe("a command killing itself with a signal", () => {
    const it = standardIoTest
      .extend("theCodeOfAKilledCommand", ({}, { onCleanup }) => {
        removePath(SELF_KILLING_ROOT);
        onCleanup(() => {
          removePath(SELF_KILLING_ROOT);
        });
        return runSpool(["--", NODE, "-e", SELF_KILLING_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => SELF_KILLING_ROOT,
        });
      })
      .extend("theSummaryOfAKilledCommand", ({ stdout }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(SELF_KILLING_ROOT);
            onCleanup(() => {
              removePath(SELF_KILLING_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", SELF_KILLING_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => SELF_KILLING_ROOT,
              }),
            );
            return stdout.text();
          }),
        ),
      )
      .extend("theRecordOfAKilledCommand", ({}, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(SELF_KILLING_ROOT);
            onCleanup(() => {
              removePath(SELF_KILLING_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", SELF_KILLING_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => SELF_KILLING_ROOT,
              }),
            );
            return readFileString(joinPath(SELF_KILLING_ROOT, SEAMED_LOG_NAME), "utf8");
          }),
        ),
      );

    it("turns the signal into a code above the signal base", ({ theCodeOfAKilledCommand }) => {
      expect(theCodeOfAKilledCommand).toBe(137);
    });

    it("names that code in the summary", ({ theSummaryOfAKilledCommand }) => {
      expect(theSummaryOfAKilledCommand).toBe(
        `spool: command: ${SELF_KILLING_COMMAND_LINE}\nspool: log: ${joinPath(SELF_KILLING_ROOT, SEAMED_LOG_NAME)} (14 bytes, 1 lines)\nspool: exit: 137 (0.0s)\nbefore signal\n`,
      );
    });

    it("keeps everything written before the signal", ({ theRecordOfAKilledCommand }) => {
      expect(theRecordOfAKilledCommand).toBe(`${SELF_KILLING_COMMAND_LINE}\n\nbefore signal\n`);
    });
  });

  describe("a command that cannot be started at all", () => {
    const it = standardIoTest
      .extend("theCodeOfAMissingExecutable", ({}, { onCleanup }) => {
        removePath(MISSING_EXECUTABLE_ROOT);
        onCleanup(() => {
          removePath(MISSING_EXECUTABLE_ROOT);
        });
        return runSpool(["--", MISSING_EXECUTABLE], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => MISSING_EXECUTABLE_ROOT,
        });
      })
      .extend("theStdoutOfAMissingExecutable", ({ stdout }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(MISSING_EXECUTABLE_ROOT);
            onCleanup(() => {
              removePath(MISSING_EXECUTABLE_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", MISSING_EXECUTABLE], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => MISSING_EXECUTABLE_ROOT,
              }),
            );
            return stdout.text();
          }),
        ),
      )
      .extend("theStderrOfAMissingExecutable", ({ stderr }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(MISSING_EXECUTABLE_ROOT);
            onCleanup(() => {
              removePath(MISSING_EXECUTABLE_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", MISSING_EXECUTABLE], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => MISSING_EXECUTABLE_ROOT,
              }),
            );
            return stderr.text();
          }),
        ),
      )
      .extend("theRecordsLeftByAMissingExecutable", ({}, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(MISSING_EXECUTABLE_ROOT);
            onCleanup(() => {
              removePath(MISSING_EXECUTABLE_ROOT);
            });
            yield* Effect.promise(() =>
              runSpool(["--", MISSING_EXECUTABLE], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => MISSING_EXECUTABLE_ROOT,
              }),
            );
            return readDirectory(MISSING_EXECUTABLE_ROOT);
          }),
        ),
      );

    it("is refused with the code kept for a command that cannot start", ({
      theCodeOfAMissingExecutable,
    }) => {
      expect(theCodeOfAMissingExecutable).toBe(127);
    });

    it("leaves standard output untouched", ({ theStdoutOfAMissingExecutable }) => {
      expect(theStdoutOfAMissingExecutable).toBe("");
    });

    it("names the reason on standard error", ({ theStderrOfAMissingExecutable }) => {
      expect(theStderrOfAMissingExecutable).toMatchInlineSnapshot(`
        "spool: command: /nonexistent/never-here
        spool: error: cannot start command: Error: spawn /nonexistent/never-here ENOENT
        "
      `);
    });

    it("leaves no record behind", ({ theRecordsLeftByAMissingExecutable }) => {
      expect(theRecordsLeftByAMissingExecutable).toStrictEqual([]);
    });
  });

  describe("a spool root that cannot be made a directory", () => {
    const it = standardIoTest
      .extend("theCodeOfABlockedRoot", ({}, { onCleanup }) => {
        removePath(BLOCKED_ROOT_PARENT);
        onCleanup(() => {
          removePath(BLOCKED_ROOT_PARENT);
        });
        makeDirectory(BLOCKED_ROOT_PARENT);
        writeFileString({ location: BLOCKED_ROOT, written: "occupied" });
        return runSpool(["--", NODE, "-e", SENTINEL_SCRIPT, SENTINEL_PATH], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => BLOCKED_ROOT,
        });
      })
      .extend("theStdoutOfABlockedRoot", ({ stdout }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(BLOCKED_ROOT_PARENT);
            onCleanup(() => {
              removePath(BLOCKED_ROOT_PARENT);
            });
            makeDirectory(BLOCKED_ROOT_PARENT);
            writeFileString({ location: BLOCKED_ROOT, written: "occupied" });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", SENTINEL_SCRIPT, SENTINEL_PATH], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => BLOCKED_ROOT,
              }),
            );
            return stdout.text();
          }),
        ),
      )
      .extend("theStderrOfABlockedRoot", ({ stderr }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(BLOCKED_ROOT_PARENT);
            onCleanup(() => {
              removePath(BLOCKED_ROOT_PARENT);
            });
            makeDirectory(BLOCKED_ROOT_PARENT);
            writeFileString({ location: BLOCKED_ROOT, written: "occupied" });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", SENTINEL_SCRIPT, SENTINEL_PATH], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => BLOCKED_ROOT,
              }),
            );
            return stderr.text();
          }),
        ),
      )
      .extend("theEntriesLeftBesideABlockedRoot", ({}, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(BLOCKED_ROOT_PARENT);
            onCleanup(() => {
              removePath(BLOCKED_ROOT_PARENT);
            });
            makeDirectory(BLOCKED_ROOT_PARENT);
            writeFileString({ location: BLOCKED_ROOT, written: "occupied" });
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", SENTINEL_SCRIPT, SENTINEL_PATH], {
                stdout: process.stdout,
                stderr: process.stderr,
                isPassthrough: () => false,
                now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                uniqueSuffix: () => SEAM_SUFFIX,
                monotonicNow: () => 0,
                spoolRoot: () => BLOCKED_ROOT,
              }),
            );
            return readDirectory(BLOCKED_ROOT_PARENT);
          }),
        ),
      );

    it("is refused with the code kept for a failed recording", ({ theCodeOfABlockedRoot }) => {
      expect(theCodeOfABlockedRoot).toBe(1);
    });

    it("leaves standard output untouched", ({ theStdoutOfABlockedRoot }) => {
      expect(theStdoutOfABlockedRoot).toBe("");
    });

    it("names the record it could not open on standard error", ({ theStderrOfABlockedRoot }) => {
      expect(theStderrOfABlockedRoot).toBe(
        `spool: command: ${SENTINEL_COMMAND_LINE}\nspool: error: cannot record to ${joinPath(BLOCKED_ROOT, SEAMED_LOG_NAME)}: Error: EEXIST: file already exists, mkdir '${BLOCKED_ROOT}'\n`,
      );
    });

    it("never lets the command run", ({ theEntriesLeftBesideABlockedRoot }) => {
      expect(theEntriesLeftBesideABlockedRoot).toStrictEqual(["blocked"]);
    });
  });

  describe("a record that breaks while the command is still writing", () => {
    const it = standardIoTest
      .extend("theCodeOfALostRecord", ({}, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(FIFO_ROOT);
            removePath(FIFO_GATE_DIRECTORY);
            onCleanup(() => {
              removePath(FIFO_ROOT);
              removePath(FIFO_GATE_DIRECTORY);
            });
            makeDirectory(FIFO_ROOT);
            makeDirectory(FIFO_GATE_DIRECTORY);
            const fifoPath = joinPath(FIFO_ROOT, SEAMED_LOG_NAME);
            if (spawnChildSync({ executable: "mkfifo", handed: [fifoPath] }).status !== 0) {
              throw new Error(`could not create the pipe at ${fifoPath}`);
            }
            const running = runSpool(["--", NODE, "-e", FIFO_SCRIPT, FIFO_GATE, FIFO_MARKER], {
              stdout: process.stdout,
              stderr: process.stderr,
              isPassthrough: () => false,
              now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
              uniqueSuffix: () => SEAM_SUFFIX,
              monotonicNow: () => 0,
              spoolRoot: () => FIFO_ROOT,
            });
            const reader = fileStreamApi.createReadStream(fifoPath);
            const observed = new CapturedStream();
            reader.pipe(observed);
            while (!observed.text().includes("phase one")) {
              yield* Effect.sleep("20 millis");
            }
            reader.destroy();
            writeFileString({ location: FIFO_GATE, written: "open" });
            return yield* Effect.promise(() => running);
          }),
        ),
      )
      .extend("theStdoutOfALostRecord", ({ stdout }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(FIFO_ROOT);
            removePath(FIFO_GATE_DIRECTORY);
            onCleanup(() => {
              removePath(FIFO_ROOT);
              removePath(FIFO_GATE_DIRECTORY);
            });
            makeDirectory(FIFO_ROOT);
            makeDirectory(FIFO_GATE_DIRECTORY);
            const fifoPath = joinPath(FIFO_ROOT, SEAMED_LOG_NAME);
            if (spawnChildSync({ executable: "mkfifo", handed: [fifoPath] }).status !== 0) {
              throw new Error(`could not create the pipe at ${fifoPath}`);
            }
            const running = runSpool(["--", NODE, "-e", FIFO_SCRIPT, FIFO_GATE, FIFO_MARKER], {
              stdout: process.stdout,
              stderr: process.stderr,
              isPassthrough: () => false,
              now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
              uniqueSuffix: () => SEAM_SUFFIX,
              monotonicNow: () => 0,
              spoolRoot: () => FIFO_ROOT,
            });
            const reader = fileStreamApi.createReadStream(fifoPath);
            const observed = new CapturedStream();
            reader.pipe(observed);
            while (!observed.text().includes("phase one")) {
              yield* Effect.sleep("20 millis");
            }
            reader.destroy();
            writeFileString({ location: FIFO_GATE, written: "open" });
            yield* Effect.promise(() => running);
            return stdout.text();
          }),
        ),
      )
      .extend("theStderrOfALostRecord", ({ stderr }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(FIFO_ROOT);
            removePath(FIFO_GATE_DIRECTORY);
            onCleanup(() => {
              removePath(FIFO_ROOT);
              removePath(FIFO_GATE_DIRECTORY);
            });
            makeDirectory(FIFO_ROOT);
            makeDirectory(FIFO_GATE_DIRECTORY);
            const fifoPath = joinPath(FIFO_ROOT, SEAMED_LOG_NAME);
            if (spawnChildSync({ executable: "mkfifo", handed: [fifoPath] }).status !== 0) {
              throw new Error(`could not create the pipe at ${fifoPath}`);
            }
            const running = runSpool(["--", NODE, "-e", FIFO_SCRIPT, FIFO_GATE, FIFO_MARKER], {
              stdout: process.stdout,
              stderr: process.stderr,
              isPassthrough: () => false,
              now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
              uniqueSuffix: () => SEAM_SUFFIX,
              monotonicNow: () => 0,
              spoolRoot: () => FIFO_ROOT,
            });
            const reader = fileStreamApi.createReadStream(fifoPath);
            const observed = new CapturedStream();
            reader.pipe(observed);
            while (!observed.text().includes("phase one")) {
              yield* Effect.sleep("20 millis");
            }
            reader.destroy();
            writeFileString({ location: FIFO_GATE, written: "open" });
            yield* Effect.promise(() => running);
            return stderr.text();
          }),
        ),
      )
      .extend("theMarkerLeftByALostRecord", ({}, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(FIFO_ROOT);
            removePath(FIFO_GATE_DIRECTORY);
            onCleanup(() => {
              removePath(FIFO_ROOT);
              removePath(FIFO_GATE_DIRECTORY);
            });
            makeDirectory(FIFO_ROOT);
            makeDirectory(FIFO_GATE_DIRECTORY);
            const fifoPath = joinPath(FIFO_ROOT, SEAMED_LOG_NAME);
            if (spawnChildSync({ executable: "mkfifo", handed: [fifoPath] }).status !== 0) {
              throw new Error(`could not create the pipe at ${fifoPath}`);
            }
            const running = runSpool(["--", NODE, "-e", FIFO_SCRIPT, FIFO_GATE, FIFO_MARKER], {
              stdout: process.stdout,
              stderr: process.stderr,
              isPassthrough: () => false,
              now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
              uniqueSuffix: () => SEAM_SUFFIX,
              monotonicNow: () => 0,
              spoolRoot: () => FIFO_ROOT,
            });
            const reader = fileStreamApi.createReadStream(fifoPath);
            const observed = new CapturedStream();
            reader.pipe(observed);
            while (!observed.text().includes("phase one")) {
              yield* Effect.sleep("20 millis");
            }
            reader.destroy();
            writeFileString({ location: FIFO_GATE, written: "open" });
            yield* Effect.promise(() => running);
            return readFileString(FIFO_MARKER);
          }),
        ),
      );

    it(
      "is refused with the code kept for a failed recording",
      { timeout: 15_000 },
      ({ theCodeOfALostRecord }) => {
        expect(theCodeOfALostRecord).toBe(1);
      },
    );

    it("leaves standard output untouched", { timeout: 15_000 }, ({ theStdoutOfALostRecord }) => {
      expect(theStdoutOfALostRecord).toBe("");
    });

    it(
      "names the record it lost on standard error",
      { timeout: 15_000 },
      ({ theStderrOfALostRecord }) => {
        expect(theStderrOfALostRecord).toBe(
          `spool: command: ${FIFO_COMMAND_LINE}\nspool: error: cannot record to ${joinPath(FIFO_ROOT, SEAMED_LOG_NAME)}: Error: EPIPE: broken pipe, write\n`,
        );
      },
    );

    it(
      "lets the command run to its own end",
      { timeout: 15_000 },
      ({ theMarkerLeftByALostRecord }) => {
        expect(theMarkerLeftByALostRecord).toBe("done");
      },
    );
  });

  describe("a run told to pass the streams through", () => {
    const it = standardIoTest.extend("theSummaryOfAPassedThroughRun", ({ stdout }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            runSpool(["--", NODE, "-e", SILENT_SCRIPT], {
              stdout: process.stdout,
              stderr: process.stderr,
              isPassthrough: () => true,
              monotonicNow: () => 0,
            }),
          );
          return stdout.text();
        }),
      ),
    );

    it("hands the run to the passing through route, which names no record", ({
      theSummaryOfAPassedThroughRun,
    }) => {
      expect(theSummaryOfAPassedThroughRun).toBe(
        `spool: command: ${SILENT_COMMAND_LINE}\nspool: exit: 0 (0.0s)\n`,
      );
    });
  });

  describe("five runs recording into one spool root at once", () => {
    const it = standardIoTest
      .extend("theCodesOfFiveConcurrentRuns", ({}, { onCleanup }) => {
        removePath(CONCURRENT_ROOT);
        onCleanup(() => {
          removePath(CONCURRENT_ROOT);
        });
        return Promise.all(
          Array.from({ length: 5 }, () => {
            return runSpool(["--", NODE, "-e", PID_SCRIPT], {
              stdout: process.stdout,
              stderr: process.stderr,
              isPassthrough: () => false,
              spoolRoot: () => CONCURRENT_ROOT,
              now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
              monotonicNow: () => 0,
            });
          }),
        );
      })
      .extend("theRecordNameShapesOfFiveConcurrentRuns", ({}, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(CONCURRENT_ROOT);
            onCleanup(() => {
              removePath(CONCURRENT_ROOT);
            });
            yield* Effect.promise(() =>
              Promise.all(
                Array.from({ length: 5 }, () => {
                  return runSpool(["--", NODE, "-e", PID_SCRIPT], {
                    stdout: process.stdout,
                    stderr: process.stderr,
                    isPassthrough: () => false,
                    spoolRoot: () => CONCURRENT_ROOT,
                    now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                    monotonicNow: () => 0,
                  });
                }),
              ),
            );
            return readDirectory(CONCURRENT_ROOT).map((logFileName) =>
              /^\d{8}T\d{6}Z-node--e-[0-9a-f]{8}\.log$/.test(logFileName),
            );
          }),
        ),
      )
      .extend("theWholeLineShapesOfFiveConcurrentRuns", ({}, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(CONCURRENT_ROOT);
            onCleanup(() => {
              removePath(CONCURRENT_ROOT);
            });
            yield* Effect.promise(() =>
              Promise.all(
                Array.from({ length: 5 }, () => {
                  return runSpool(["--", NODE, "-e", PID_SCRIPT], {
                    stdout: process.stdout,
                    stderr: process.stderr,
                    isPassthrough: () => false,
                    spoolRoot: () => CONCURRENT_ROOT,
                    now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                    monotonicNow: () => 0,
                  });
                }),
              ),
            );
            return readDirectory(CONCURRENT_ROOT).map((logFileName) =>
              /^\d+\n$/.test(
                readFileString(joinPath(CONCURRENT_ROOT, logFileName), "utf8").split("\n\n")[1] ??
                  "",
              ),
            );
          }),
        ),
      )
      .extend("theFirstAppearanceShapesOfFiveConcurrentRunBodies", ({}, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            removePath(CONCURRENT_ROOT);
            onCleanup(() => {
              removePath(CONCURRENT_ROOT);
            });
            yield* Effect.promise(() =>
              Promise.all(
                Array.from({ length: 5 }, () => {
                  return runSpool(["--", NODE, "-e", PID_SCRIPT], {
                    stdout: process.stdout,
                    stderr: process.stderr,
                    isPassthrough: () => false,
                    spoolRoot: () => CONCURRENT_ROOT,
                    now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
                    monotonicNow: () => 0,
                  });
                }),
              ),
            );
            const recordedPidLines = readDirectory(CONCURRENT_ROOT).map(
              (logFileName) =>
                readFileString(joinPath(CONCURRENT_ROOT, logFileName), "utf8").split("\n\n")[1] ??
                "",
            );
            return recordedPidLines.map(
              (recordedPidLine, index) => recordedPidLines.indexOf(recordedPidLine) === index,
            );
          }),
        ),
      );

    it(
      "hands every code back unchanged",
      { timeout: 15_000 },
      ({ theCodesOfFiveConcurrentRuns }) => {
        expect(theCodesOfFiveConcurrentRuns).toStrictEqual([0, 0, 0, 0, 0]);
      },
    );

    it(
      "gives each run a record of its own",
      { timeout: 15_000 },
      ({ theRecordNameShapesOfFiveConcurrentRuns }) => {
        expect(theRecordNameShapesOfFiveConcurrentRuns).toStrictEqual([
          true,
          true,
          true,
          true,
          true,
        ]);
      },
    );

    it(
      "closes each record on the single line its command wrote",
      { timeout: 15_000 },
      ({ theWholeLineShapesOfFiveConcurrentRuns }) => {
        expect(theWholeLineShapesOfFiveConcurrentRuns).toStrictEqual([
          true,
          true,
          true,
          true,
          true,
        ]);
      },
    );

    it(
      "keeps the runs from mixing into one another",
      { timeout: 15_000 },
      ({ theFirstAppearanceShapesOfFiveConcurrentRunBodies }) => {
        expect(theFirstAppearanceShapesOfFiveConcurrentRunBodies).toStrictEqual([
          true,
          true,
          true,
          true,
          true,
        ]);
      },
    );
  });

  describe("a run measured at twelve and a bit seconds", () => {
    const it = standardIoTest.extend("theSummaryOfATwelveSecondRun", ({ stdout }, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          removePath(ELAPSED_SECONDS_ROOT);
          onCleanup(() => {
            removePath(ELAPSED_SECONDS_ROOT);
          });
          const ticks = [0, 12_399].values();
          yield* Effect.promise(() =>
            runSpool(["--", NODE, "-e", ELAPSED_SECONDS_SCRIPT], {
              stdout: process.stdout,
              stderr: process.stderr,
              isPassthrough: () => false,
              spoolRoot: () => ELAPSED_SECONDS_ROOT,
              now: () => DateTime.toDate(DateTime.makeUnsafe(SEAM_INSTANT)),
              uniqueSuffix: () => SEAM_SUFFIX,
              monotonicNow: () => ticks.next().value ?? 0,
            }),
          );
          return stdout.text();
        }),
      ),
    );

    it("cuts the elapsed time down to a tenth of a second", ({ theSummaryOfATwelveSecondRun }) => {
      expect(theSummaryOfATwelveSecondRun).toBe(
        `spool: command: ${ELAPSED_SECONDS_COMMAND_LINE}\nspool: log: ${joinPath(ELAPSED_SECONDS_ROOT, SEAMED_LOG_NAME)} (2 bytes, 1 lines)\nspool: exit: 0 (12.3s)\n`,
      );
    });
  });

  describe("a run handed no seams at all", () => {
    const it = standardIoTest
      .extend("theCodeOfADefaultRun", ({ stdout }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            vi.stubEnv("CI", undefined);
            const exitCode = yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", DEFAULT_RUN_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
              }),
            );
            onCleanup(() => {
              removePath(
                /spool: log: (.+) \(\d+ bytes, \d+ lines\)/.exec(stdout.text())?.[1] ?? "",
              );
            });
            return exitCode;
          }),
        ),
      )
      .extend("theSpoolDirectoryOfADefaultRun", ({ stdout }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            vi.stubEnv("CI", undefined);
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", DEFAULT_RUN_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
              }),
            );
            const recordPath =
              /spool: log: (.+) \(\d+ bytes, \d+ lines\)/.exec(stdout.text())?.[1] ?? "";
            onCleanup(() => {
              removePath(recordPath);
            });
            return parentPath(recordPath);
          }),
        ),
      )
      .extend("theRecordNameShapeOfADefaultRun", ({ stdout }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            vi.stubEnv("CI", undefined);
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", DEFAULT_RUN_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
              }),
            );
            const recordPath =
              /spool: log: (.+) \(\d+ bytes, \d+ lines\)/.exec(stdout.text())?.[1] ?? "";
            onCleanup(() => {
              removePath(recordPath);
            });
            return /^\d{8}T\d{6}Z-node--e-[0-9a-f]{8}\.log$/.test(baseName(recordPath));
          }),
        ),
      )
      .extend("theRecordOfADefaultRun", ({ stdout }, { onCleanup }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            vi.stubEnv("CI", undefined);
            yield* Effect.promise(() =>
              runSpool(["--", NODE, "-e", DEFAULT_RUN_SCRIPT], {
                stdout: process.stdout,
                stderr: process.stderr,
              }),
            );
            const recordPath =
              /spool: log: (.+) \(\d+ bytes, \d+ lines\)/.exec(stdout.text())?.[1] ?? "";
            onCleanup(() => {
              removePath(recordPath);
            });
            return readFileString(recordPath);
          }),
        ),
      );

    it("hands the code of the command back unchanged", ({ theCodeOfADefaultRun }) => {
      expect(theCodeOfADefaultRun).toBe(0);
    });

    it("records into the spool directory of the work tree", ({
      theSpoolDirectoryOfADefaultRun,
    }) => {
      expect(theSpoolDirectoryOfADefaultRun).toBe(joinPath(process.cwd(), ".spool"));
    });

    it("names the record by the instant, the command and a random unique part", ({
      theRecordNameShapeOfADefaultRun,
    }) => {
      expect(theRecordNameShapeOfADefaultRun).toBe(true);
    });

    it("records the command and everything it wrote", ({ theRecordOfADefaultRun }) => {
      expect(theRecordOfADefaultRun).toBe(`${DEFAULT_RUN_COMMAND_LINE}\n\ndefault run\n`);
    });
  });
});
