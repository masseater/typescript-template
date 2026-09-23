import { standardIoTest } from "@repo/dont-review-it";
import { Effect } from "effect";
import { describe, expect, vi } from "vite-plus/test";

import {
  epochMillis,
  fileExists,
  joinPath,
  readDirectory,
  readFileString,
  removePath,
  writeFileString,
} from "../host.ts";
import { runThrottle } from "./run-throttle.ts";

const nodeFs = process.getBuiltinModule("fs") as {
  readonly mkdtempSync: (prefix: string) => string;
  readonly realpathSync: (location: string) => string;
};

const nodeOs = process.getBuiltinModule("os") as {
  readonly tmpdir: () => string;
};

const TRIVIAL_COMMAND = ["--", process.execPath, "-e", ""];

const SLOT_MARKER_PATTERN = /^slot-\d+$/u;

describe("runThrottle", () => {
  const throttleTest = standardIoTest
    .extend("slotDirectory", ({}, { onCleanup }) => {
      const slotArea = nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "throttle-run-"));
      onCleanup(() => {
        removePath(slotArea);
      });
      return slotArea;
    })
    .extend("stampsDirectory", ({}, { onCleanup }) => {
      const stampsArea = nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "throttle-stamps-"));
      onCleanup(() => {
        removePath(stampsArea);
      });
      return stampsArea;
    });

  describe("a run under every default", () => {
    const it = throttleTest
      .extend("theCodeOfARunUnderEveryDefault", ({ slotDirectory }) => {
        vi.stubEnv("MST_THROTTLE_LIMIT", undefined);
        vi.stubEnv("TMPDIR", slotDirectory);
        return runThrottle(TRIVIAL_COMMAND);
      })
      .extend("theAcquisitionNamedUnderEveryDefault", ({ slotDirectory, stderr }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            vi.stubEnv("MST_THROTTLE_LIMIT", undefined);
            vi.stubEnv("TMPDIR", slotDirectory);
            yield* Effect.promise(() => runThrottle(TRIVIAL_COMMAND));
            return stderr.text().includes("throttle: acquiring a slot (limit 1)");
          }),
        ),
      )
      .extend("theCommandLineNamedUnderEveryDefault", ({ slotDirectory, stderr }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            vi.stubEnv("MST_THROTTLE_LIMIT", undefined);
            vi.stubEnv("TMPDIR", slotDirectory);
            yield* Effect.promise(() => runThrottle(TRIVIAL_COMMAND));
            return stderr.text().includes(`throttle: run ${process.execPath} -e `);
          }),
        ),
      );

    it("succeeds", { timeout: 30_000 }, ({ theCodeOfARunUnderEveryDefault }) => {
      expect(theCodeOfARunUnderEveryDefault).toBe(0);
    });

    it(
      "announces the acquisition on stderr",
      { timeout: 30_000 },
      ({ theAcquisitionNamedUnderEveryDefault }) => {
        expect(theAcquisitionNamedUnderEveryDefault).toBe(true);
      },
    );

    it(
      "announces the command line on stderr",
      { timeout: 30_000 },
      ({ theCommandLineNamedUnderEveryDefault }) => {
        expect(theCommandLineNamedUnderEveryDefault).toBe(true);
      },
    );
  });

  describe("no command at all", () => {
    const it = throttleTest
      .extend("theCodeOfNoCommandAtAll", () => runThrottle([]))
      .extend("theUsageNamedForNoCommand", ({ stderr }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* Effect.promise(() => runThrottle([]));
            return stderr.text().includes("Usage: throttle");
          }),
        ),
      )
      .extend("theStandardOutputOfNoCommand", ({ stdout }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* Effect.promise(() => runThrottle([]));
            return stdout.text();
          }),
        ),
      )
      .extend("theStandardErrorOfNoCommand", ({ stderr }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* Effect.promise(() => runThrottle([]));
            return stderr.text();
          }),
        ),
      );

    it("is refused", ({ theCodeOfNoCommandAtAll }) => {
      expect(theCodeOfNoCommandAtAll).toBe(2);
    });

    it("puts the usage on stderr", ({ theUsageNamedForNoCommand }) => {
      expect(theUsageNamedForNoCommand).toBe(true);
    });

    it("puts nothing on stdout", ({ theStandardOutputOfNoCommand }) => {
      expect(theStandardOutputOfNoCommand).toMatchInlineSnapshot(`""`);
    });

    it("puts the whole refusal on stderr", ({ theStandardErrorOfNoCommand }) => {
      expect(theStandardErrorOfNoCommand).toMatchInlineSnapshot(`
        "Usage: throttle [--timeout <seconds>] -- <command> [args...]

        Runs the command while keeping the number of simultaneous executions that
        share this host and namespace at or below the limit. When every slot is held
        the wrapper joins a wait queue, reports its position on stderr, and retries
        every slot on each poll, for at most the wait budget. The operating system
        releases a slot when its holder exits, including an abrupt termination. Do
        not nest throttle inside a command it wraps: the inner call counts
        as one more competitor and consumes a second slot.

        Options:
          --timeout <seconds>  Stop the command's whole process tree after this many
                               seconds. POSIX sends SIGTERM, then SIGKILL after a short
                               grace period; Windows uses taskkill /T /F immediately.
                               0 never interrupts the command. Defaults to 0.

        Environment:
          MST_THROTTLE_LIMIT   Number of slots shared by every throttle on this host
                               and namespace. Invalid values (non-integer, zero or
                               less) fall back to the default of 1.

        Exit codes:
          0  the wrapped command succeeded
          1  the wrapped command failed, was killed, could not be started, ran past
             the timeout, or the wrapper could not get or release a slot
          2  throttle itself was called incorrectly
        "
      `);
    });
  });

  describe("a separator with nothing behind it", () => {
    const it = throttleTest.extend("theCodeOfASeparatorAlone", () => runThrottle(["--"]));

    it("is refused", ({ theCodeOfASeparatorAlone }) => {
      expect(theCodeOfASeparatorAlone).toBe(2);
    });
  });

  describe("a fractional timeout", () => {
    const it = throttleTest
      .extend("theCodeOfAFractionalTimeout", ({ slotDirectory }) =>
        runThrottle(["--timeout", "1.5", ...TRIVIAL_COMMAND], {
          slotDir: joinPath(slotDirectory, "slots"),
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        }),
      )
      .extend("theFractionalTimeoutIsNamedBack", ({ slotDirectory, stderr }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* Effect.promise(() =>
              runThrottle(["--timeout", "1.5", ...TRIVIAL_COMMAND], {
                slotDir: joinPath(slotDirectory, "slots"),
                limit: 1,
                waitBudgetMs: 15_000,
                pollMs: 50,
                isInteractive: false,
              }),
            );
            return stderr.text().includes('got "1.5"');
          }),
        ),
      )
      .extend("theSlotAreaAfterARefusedTimeout", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* Effect.promise(() =>
              runThrottle(["--timeout", "1.5", ...TRIVIAL_COMMAND], {
                slotDir: joinPath(slotDirectory, "slots"),
                limit: 1,
                waitBudgetMs: 15_000,
                pollMs: 50,
                isInteractive: false,
              }),
            );
            return fileExists(joinPath(slotDirectory, "slots"));
          }),
        ),
      );

    it("is refused", ({ theCodeOfAFractionalTimeout }) => {
      expect(theCodeOfAFractionalTimeout).toBe(2);
    });

    it("is named back on stderr", ({ theFractionalTimeoutIsNamedBack }) => {
      expect(theFractionalTimeoutIsNamedBack).toBe(true);
    });

    it("leaves no slot area behind", ({ theSlotAreaAfterARefusedTimeout }) => {
      expect(theSlotAreaAfterARefusedTimeout).toBe(false);
    });
  });

  describe("a negative timeout", () => {
    const it = throttleTest
      .extend("theCodeOfANegativeTimeout", ({ slotDirectory }) =>
        runThrottle(["--timeout=-9", ...TRIVIAL_COMMAND], {
          slotDir: joinPath(slotDirectory, "slots"),
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        }),
      )
      .extend("theNegativeTimeoutIsNamedBack", ({ slotDirectory, stderr }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* Effect.promise(() =>
              runThrottle(["--timeout=-9", ...TRIVIAL_COMMAND], {
                slotDir: joinPath(slotDirectory, "slots"),
                limit: 1,
                waitBudgetMs: 15_000,
                pollMs: 50,
                isInteractive: false,
              }),
            );
            return stderr.text().includes('got "-9"');
          }),
        ),
      );

    it("is refused", ({ theCodeOfANegativeTimeout }) => {
      expect(theCodeOfANegativeTimeout).toBe(2);
    });

    it("is named back on stderr", ({ theNegativeTimeoutIsNamedBack }) => {
      expect(theNegativeTimeoutIsNamedBack).toBe(true);
    });
  });

  describe("an unknown option", () => {
    const it = throttleTest
      .extend("theCodeOfAnUnknownOption", () => runThrottle(["--limit", "3", ...TRIVIAL_COMMAND]))
      .extend("theUsageNamedForAnUnknownOption", ({ stderr }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* Effect.promise(() => runThrottle(["--limit", "3", ...TRIVIAL_COMMAND]));
            return stderr.text().includes("Usage: throttle");
          }),
        ),
      );

    it("is refused", ({ theCodeOfAnUnknownOption }) => {
      expect(theCodeOfAnUnknownOption).toBe(2);
    });

    it("puts the usage on stderr", ({ theUsageNamedForAnUnknownOption }) => {
      expect(theUsageNamedForAnUnknownOption).toBe(true);
    });
  });

  describe("two runs sharing one slot", () => {
    const it = throttleTest
      .extend("theCodesOfTwoRunsUnderOneSlot", ({ slotDirectory, stampsDirectory }) => {
        const seams = {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        };
        return Promise.all([
          runThrottle(
            [
              "--",
              process.execPath,
              "-e",
              `const { writeFileSync } = require("node:fs"); writeFileSync("${joinPath(stampsDirectory, "a-start")}", String(Date.now())); setTimeout(() => { writeFileSync("${joinPath(stampsDirectory, "a-end")}", String(Date.now())); }, 400);`,
            ],
            seams,
          ),
          runThrottle(
            [
              "--",
              process.execPath,
              "-e",
              `const { writeFileSync } = require("node:fs"); writeFileSync("${joinPath(stampsDirectory, "b-start")}", String(Date.now())); setTimeout(() => { writeFileSync("${joinPath(stampsDirectory, "b-end")}", String(Date.now())); }, 400);`,
            ],
            seams,
          ),
        ]);
      })
      .extend("twoRunsUnderOneSlotNeverOverlapped", ({ slotDirectory, stampsDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            const seams = {
              slotDir: slotDirectory,
              limit: 1,
              waitBudgetMs: 15_000,
              pollMs: 50,
              isInteractive: false,
            };
            yield* Effect.promise(() =>
              Promise.all([
                runThrottle(
                  [
                    "--",
                    process.execPath,
                    "-e",
                    `const { writeFileSync } = require("node:fs"); writeFileSync("${joinPath(stampsDirectory, "a-start")}", String(Date.now())); setTimeout(() => { writeFileSync("${joinPath(stampsDirectory, "a-end")}", String(Date.now())); }, 400);`,
                  ],
                  seams,
                ),
                runThrottle(
                  [
                    "--",
                    process.execPath,
                    "-e",
                    `const { writeFileSync } = require("node:fs"); writeFileSync("${joinPath(stampsDirectory, "b-start")}", String(Date.now())); setTimeout(() => { writeFileSync("${joinPath(stampsDirectory, "b-end")}", String(Date.now())); }, 400);`,
                  ],
                  seams,
                ),
              ]),
            );
            const aStart = Number(readFileString(joinPath(stampsDirectory, "a-start"), "utf8"));
            const aEnd = Number(readFileString(joinPath(stampsDirectory, "a-end"), "utf8"));
            const bStart = Number(readFileString(joinPath(stampsDirectory, "b-start"), "utf8"));
            const bEnd = Number(readFileString(joinPath(stampsDirectory, "b-end"), "utf8"));
            return aStart <= bStart ? bStart >= aEnd : aStart >= bEnd;
          }),
        ),
      )
      .extend(
        "theRankNamedWhileTwoRunsShareOneSlot",
        ({ slotDirectory, stampsDirectory, stderr }) =>
          Effect.runPromise(
            Effect.gen(function* () {
              const seams = {
                slotDir: slotDirectory,
                limit: 1,
                waitBudgetMs: 15_000,
                pollMs: 50,
                isInteractive: false,
              };
              yield* Effect.promise(() =>
                Promise.all([
                  runThrottle(
                    [
                      "--",
                      process.execPath,
                      "-e",
                      `const { writeFileSync } = require("node:fs"); writeFileSync("${joinPath(stampsDirectory, "a-start")}", String(Date.now())); setTimeout(() => { writeFileSync("${joinPath(stampsDirectory, "a-end")}", String(Date.now())); }, 400);`,
                    ],
                    seams,
                  ),
                  runThrottle(
                    [
                      "--",
                      process.execPath,
                      "-e",
                      `const { writeFileSync } = require("node:fs"); writeFileSync("${joinPath(stampsDirectory, "b-start")}", String(Date.now())); setTimeout(() => { writeFileSync("${joinPath(stampsDirectory, "b-end")}", String(Date.now())); }, 400);`,
                    ],
                    seams,
                  ),
                ]),
              );
              return stderr.text().includes("throttle: waiting 1/1");
            }),
          ),
      );

    it("both run", { timeout: 20_000 }, ({ theCodesOfTwoRunsUnderOneSlot }) => {
      expect(theCodesOfTwoRunsUnderOneSlot).toStrictEqual([0, 0]);
    });

    it(
      "never run at the same time",
      { timeout: 20_000 },
      ({ twoRunsUnderOneSlotNeverOverlapped }) => {
        expect(twoRunsUnderOneSlotNeverOverlapped).toBe(true);
      },
    );

    it(
      "the one that waited names its rank on stderr",
      { timeout: 20_000 },
      ({ theRankNamedWhileTwoRunsShareOneSlot }) => {
        expect(theRankNamedWhileTwoRunsShareOneSlot).toBe(true);
      },
    );
  });

  describe("a run finding a free slot", () => {
    const it = throttleTest
      .extend("theCodeOfARunTakingAFreeSlot", ({ slotDirectory }) =>
        runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 30_000,
          isInteractive: false,
        }),
      )
      .extend("aFreeSlotIsTakenWellBelowOnePollInterval", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            const before = epochMillis();
            yield* Effect.promise(() =>
              runThrottle(TRIVIAL_COMMAND, {
                slotDir: slotDirectory,
                limit: 1,
                waitBudgetMs: 15_000,
                pollMs: 30_000,
                isInteractive: false,
              }),
            );
            return epochMillis() - before < 20_000;
          }),
        ),
      )
      .extend("theWaitingNamedWhileTakingAFreeSlot", ({ slotDirectory, stderr }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* Effect.promise(() =>
              runThrottle(TRIVIAL_COMMAND, {
                slotDir: slotDirectory,
                limit: 1,
                waitBudgetMs: 15_000,
                pollMs: 30_000,
                isInteractive: false,
              }),
            );
            return stderr.text().includes("waiting");
          }),
        ),
      );

    it("runs the command", { timeout: 30_000 }, ({ theCodeOfARunTakingAFreeSlot }) => {
      expect(theCodeOfARunTakingAFreeSlot).toBe(0);
    });

    it(
      "takes it well below one poll interval",
      { timeout: 30_000 },
      ({ aFreeSlotIsTakenWellBelowOnePollInterval }) => {
        expect(aFreeSlotIsTakenWellBelowOnePollInterval).toBe(true);
      },
    );

    it(
      "puts no waiting output on stderr",
      { timeout: 30_000 },
      ({ theWaitingNamedWhileTakingAFreeSlot }) => {
        expect(theWaitingNamedWhileTakingAFreeSlot).toBe(false);
      },
    );
  });

  describe("two runs in different namespaces", () => {
    const it = throttleTest
      .extend("theCodesOfTwoRunsInDifferentNamespaces", ({ slotDirectory, stampsDirectory }) =>
        Promise.all([
          runThrottle(
            [
              "--",
              process.execPath,
              "-e",
              `const { writeFileSync } = require("node:fs"); writeFileSync("${joinPath(stampsDirectory, "a-start")}", String(Date.now())); setTimeout(() => { writeFileSync("${joinPath(stampsDirectory, "a-end")}", String(Date.now())); }, 400);`,
            ],
            {
              slotDir: joinPath(slotDirectory, "a"),
              limit: 1,
              waitBudgetMs: 15_000,
              pollMs: 50,
              isInteractive: false,
            },
          ),
          runThrottle(
            [
              "--",
              process.execPath,
              "-e",
              `const { writeFileSync } = require("node:fs"); writeFileSync("${joinPath(stampsDirectory, "b-start")}", String(Date.now())); setTimeout(() => { writeFileSync("${joinPath(stampsDirectory, "b-end")}", String(Date.now())); }, 400);`,
            ],
            {
              slotDir: joinPath(slotDirectory, "b"),
              limit: 1,
              waitBudgetMs: 15_000,
              pollMs: 50,
              isInteractive: false,
            },
          ),
        ]),
      )
      .extend("twoRunsInDifferentNamespacesOverlapped", ({ slotDirectory, stampsDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* Effect.promise(() =>
              Promise.all([
                runThrottle(
                  [
                    "--",
                    process.execPath,
                    "-e",
                    `const { writeFileSync } = require("node:fs"); writeFileSync("${joinPath(stampsDirectory, "a-start")}", String(Date.now())); setTimeout(() => { writeFileSync("${joinPath(stampsDirectory, "a-end")}", String(Date.now())); }, 400);`,
                  ],
                  {
                    slotDir: joinPath(slotDirectory, "a"),
                    limit: 1,
                    waitBudgetMs: 15_000,
                    pollMs: 50,
                    isInteractive: false,
                  },
                ),
                runThrottle(
                  [
                    "--",
                    process.execPath,
                    "-e",
                    `const { writeFileSync } = require("node:fs"); writeFileSync("${joinPath(stampsDirectory, "b-start")}", String(Date.now())); setTimeout(() => { writeFileSync("${joinPath(stampsDirectory, "b-end")}", String(Date.now())); }, 400);`,
                  ],
                  {
                    slotDir: joinPath(slotDirectory, "b"),
                    limit: 1,
                    waitBudgetMs: 15_000,
                    pollMs: 50,
                    isInteractive: false,
                  },
                ),
              ]),
            );
            const aStart = Number(readFileString(joinPath(stampsDirectory, "a-start"), "utf8"));
            const aEnd = Number(readFileString(joinPath(stampsDirectory, "a-end"), "utf8"));
            const bStart = Number(readFileString(joinPath(stampsDirectory, "b-start"), "utf8"));
            const bEnd = Number(readFileString(joinPath(stampsDirectory, "b-end"), "utf8"));
            return aStart < bEnd && bStart < aEnd;
          }),
        ),
      );

    it("both run", { timeout: 30_000 }, ({ theCodesOfTwoRunsInDifferentNamespaces }) => {
      expect(theCodesOfTwoRunsInDifferentNamespaces).toStrictEqual([0, 0]);
    });

    it("never contend", { timeout: 30_000 }, ({ twoRunsInDifferentNamespacesOverlapped }) => {
      expect(twoRunsInDifferentNamespacesOverlapped).toBe(true);
    });
  });

  describe("three runs under an environment limit of two", () => {
    const it = throttleTest
      .extend("theCodesOfThreeRunsUnderTwoSlots", ({ slotDirectory, stampsDirectory }) => {
        vi.stubEnv("MST_THROTTLE_LIMIT", "2");
        const seams = {
          slotDir: slotDirectory,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        };
        return Promise.all(
          ["a", "b", "c"].map((stampPrefix) =>
            runThrottle(
              [
                "--",
                process.execPath,
                "-e",
                `const { writeFileSync } = require("node:fs"); writeFileSync("${joinPath(stampsDirectory, `${stampPrefix}-start`)}", String(Date.now())); setTimeout(() => { writeFileSync("${joinPath(stampsDirectory, `${stampPrefix}-end`)}", String(Date.now())); }, 1500);`,
              ],
              seams,
            ),
          ),
        );
      })
      .extend("thePeakOfThreeRunsUnderTwoSlots", ({ slotDirectory, stampsDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            vi.stubEnv("MST_THROTTLE_LIMIT", "2");
            const seams = {
              slotDir: slotDirectory,
              waitBudgetMs: 15_000,
              pollMs: 50,
              isInteractive: false,
            };
            yield* Effect.promise(() =>
              Promise.all(
                ["a", "b", "c"].map((stampPrefix) =>
                  runThrottle(
                    [
                      "--",
                      process.execPath,
                      "-e",
                      `const { writeFileSync } = require("node:fs"); writeFileSync("${joinPath(stampsDirectory, `${stampPrefix}-start`)}", String(Date.now())); setTimeout(() => { writeFileSync("${joinPath(stampsDirectory, `${stampPrefix}-end`)}", String(Date.now())); }, 1500);`,
                    ],
                    seams,
                  ),
                ),
              ),
            );
            const spans = ["a", "b", "c"].map((stampPrefix) => ({
              start: Number(
                readFileString(joinPath(stampsDirectory, `${stampPrefix}-start`), "utf8"),
              ),
              end: Number(readFileString(joinPath(stampsDirectory, `${stampPrefix}-end`), "utf8")),
            }));
            return Math.max(
              ...spans.map(
                ({ start }) =>
                  spans.filter(
                    (candidateSpan) => candidateSpan.start <= start && start < candidateSpan.end,
                  ).length,
              ),
            );
          }),
        ),
      );

    it("every run finishes", { timeout: 30_000 }, ({ theCodesOfThreeRunsUnderTwoSlots }) => {
      expect(theCodesOfThreeRunsUnderTwoSlots).toStrictEqual([0, 0, 0]);
    });

    it("two really run at a time", { timeout: 30_000 }, ({ thePeakOfThreeRunsUnderTwoSlots }) => {
      expect(thePeakOfThreeRunsUnderTwoSlots).toBe(2);
    });
  });

  describe("an environment limit of two", () => {
    const it = throttleTest.extend(
      "theSecondSlotMarkerUnderALimitOfTwo",
      ({ slotDirectory, stampsDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            vi.stubEnv("MST_THROTTLE_LIMIT", "2");
            yield* Effect.promise(() =>
              runThrottle(
                [
                  "--",
                  process.execPath,
                  "-e",
                  `const { writeFileSync } = require("node:fs"); writeFileSync("${joinPath(stampsDirectory, "a-start")}", String(Date.now()));`,
                ],
                {
                  slotDir: slotDirectory,
                  waitBudgetMs: 15_000,
                  pollMs: 50,
                  isInteractive: false,
                },
              ),
            );
            return fileExists(joinPath(slotDirectory, "slot-1"));
          }),
        ),
    );

    it(
      "creates the second slot marker",
      { timeout: 30_000 },
      ({ theSecondSlotMarkerUnderALimitOfTwo }) => {
        expect(theSecondSlotMarkerUnderALimitOfTwo).toBe(true);
      },
    );
  });

  describe("a worded environment limit", () => {
    const it = throttleTest
      .extend("theCodeOfARunUnderAWordedLimit", ({ slotDirectory }) => {
        vi.stubEnv("MST_THROTTLE_LIMIT", "abc");
        return runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          waitBudgetMs: 5000,
          pollMs: 1000,
          isInteractive: false,
        });
      })
      .extend("theMarkersUnderAWordedLimit", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            vi.stubEnv("MST_THROTTLE_LIMIT", "abc");
            yield* Effect.promise(() =>
              runThrottle(TRIVIAL_COMMAND, {
                slotDir: slotDirectory,
                waitBudgetMs: 5000,
                pollMs: 1000,
                isInteractive: false,
              }),
            );
            return readDirectory(slotDirectory).filter((slotFileName) =>
              SLOT_MARKER_PATTERN.test(slotFileName),
            );
          }),
        ),
      );

    it("does not fail the run", { timeout: 30_000 }, ({ theCodeOfARunUnderAWordedLimit }) => {
      expect(theCodeOfARunUnderAWordedLimit).toBe(0);
    });

    it("falls back to one slot", { timeout: 30_000 }, ({ theMarkersUnderAWordedLimit }) => {
      expect(theMarkersUnderAWordedLimit).toStrictEqual(["slot-0"]);
    });
  });

  describe("an environment limit of zero", () => {
    const it = throttleTest.extend("theMarkersUnderALimitOfZero", ({ slotDirectory }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          vi.stubEnv("MST_THROTTLE_LIMIT", "0");
          yield* Effect.promise(() =>
            runThrottle(TRIVIAL_COMMAND, {
              slotDir: slotDirectory,
              waitBudgetMs: 5000,
              pollMs: 1000,
              isInteractive: false,
            }),
          );
          return readDirectory(slotDirectory).filter((slotFileName) =>
            SLOT_MARKER_PATTERN.test(slotFileName),
          );
        }),
      ),
    );

    it("falls back to one slot", { timeout: 30_000 }, ({ theMarkersUnderALimitOfZero }) => {
      expect(theMarkersUnderALimitOfZero).toStrictEqual(["slot-0"]);
    });
  });

  describe("a negative environment limit", () => {
    const it = throttleTest.extend("theMarkersUnderANegativeLimit", ({ slotDirectory }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          vi.stubEnv("MST_THROTTLE_LIMIT", "-3");
          yield* Effect.promise(() =>
            runThrottle(TRIVIAL_COMMAND, {
              slotDir: slotDirectory,
              waitBudgetMs: 5000,
              pollMs: 1000,
              isInteractive: false,
            }),
          );
          return readDirectory(slotDirectory).filter((slotFileName) =>
            SLOT_MARKER_PATTERN.test(slotFileName),
          );
        }),
      ),
    );

    it("falls back to one slot", { timeout: 30_000 }, ({ theMarkersUnderANegativeLimit }) => {
      expect(theMarkersUnderANegativeLimit).toStrictEqual(["slot-0"]);
    });
  });

  describe("an unusable slot area", () => {
    const it = throttleTest
      .extend("theCodeOfAnUnusableSlotArea", ({ slotDirectory }) => {
        const plainFile = joinPath(slotDirectory, "plain-file");
        writeFileString({ location: plainFile, written: "" });
        return runThrottle(TRIVIAL_COMMAND, {
          slotDir: joinPath(plainFile, "nested"),
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        });
      })
      .extend("theFailureNamedForAnUnusableSlotArea", ({ slotDirectory, stderr }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            const plainFile = joinPath(slotDirectory, "plain-file");
            writeFileString({ location: plainFile, written: "" });
            yield* Effect.promise(() =>
              runThrottle(TRIVIAL_COMMAND, {
                slotDir: joinPath(plainFile, "nested"),
                limit: 1,
                waitBudgetMs: 15_000,
                pollMs: 50,
                isInteractive: false,
              }),
            );
            return stderr.text().includes("throttle: ");
          }),
        ),
      )
      .extend("theUsageNamedForAnUnusableSlotArea", ({ slotDirectory, stderr }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            const plainFile = joinPath(slotDirectory, "plain-file");
            writeFileString({ location: plainFile, written: "" });
            yield* Effect.promise(() =>
              runThrottle(TRIVIAL_COMMAND, {
                slotDir: joinPath(plainFile, "nested"),
                limit: 1,
                waitBudgetMs: 15_000,
                pollMs: 50,
                isInteractive: false,
              }),
            );
            return stderr.text().includes("Usage: throttle");
          }),
        ),
      );

    it("fails the run", ({ theCodeOfAnUnusableSlotArea }) => {
      expect(theCodeOfAnUnusableSlotArea).toBe(1);
    });

    it("is reported as a throttle failure", ({ theFailureNamedForAnUnusableSlotArea }) => {
      expect(theFailureNamedForAnUnusableSlotArea).toBe(true);
    });

    it("is not reported as misuse", ({ theUsageNamedForAnUnusableSlotArea }) => {
      expect(theUsageNamedForAnUnusableSlotArea).toBe(false);
    });
  });
});
