import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";

import { standardIoTest } from "@repo/dont-review-it";
import { Effect } from "effect";
import { describe, expect, vi } from "vite-plus/test";

import {
  delay,
  epochMillis,
  joinPath,
  makeTempDirectory,
  readFileString,
  removePath,
  writeFileString,
} from "../host.ts";
import { CHILD_PROCESS_EVENT } from "../node-event-names.ts";
import { spawnChild } from "../node-spawn.ts";
import { TREE_TERMINATION_SIGNAL } from "./process-tree.ts";
import { runWithSlot } from "./run-command.ts";
import { runThrottle } from "./run-throttle.ts";

class FakeChildProcess extends EventEmitter {
  pid: number | undefined;
}

const TRIVIAL_COMMAND = ["--", process.execPath, "-e", ""];

const FAILING_COMMAND = ["--", process.execPath, "-e", "process.exit(3);"];

const SELF_KILLING_COMMAND = [
  "--",
  process.execPath,
  "-e",
  "process.kill(process.pid, 'SIGTERM');",
];

const MISSING_EXECUTABLE = "/no/such/executable-for-throttle";

const SLEEPING_COMMAND = [
  "--timeout",
  "1",
  "--",
  process.execPath,
  "-e",
  "setTimeout(() => {}, 30000);",
];

const WAIT_BUDGET_MS = 30_000;

const POLL_MS = 10_000;

const KNOWN_CHILD_PID = 314_159;

const LINGERING_ARGUMENTS = ["-e", "setInterval(() => {}, 1000);"];

class ChildProcessWithKnownPid extends FakeChildProcess {
  override readonly pid = KNOWN_CHILD_PID;
}

describe("runWithSlot", () => {
  const test = standardIoTest.extend("slotDirectory", ({}, { onCleanup }) => {
    const madeSlotDirectory = makeTempDirectory("throttle-command-");
    onCleanup(() => {
      removePath(madeSlotDirectory);
    });
    return madeSlotDirectory;
  });

  describe("a command that exits zero", () => {
    const it = test.extend("theCodeOfATrivialCommand", ({ slotDirectory }) =>
      runThrottle(TRIVIAL_COMMAND, {
        slotDir: slotDirectory,
        limit: 1,
        waitBudgetMs: WAIT_BUDGET_MS,
        pollMs: POLL_MS,
        isInteractive: false,
      }));

    it("is reported as a pass", { timeout: 30_000 }, ({ theCodeOfATrivialCommand }) => {
      expect(theCodeOfATrivialCommand).toBe(0);
    });
  });

  describe("a command that runs after a failed one", () => {
    const it = test.extend("theCodeOfARunFollowingAFailedOne", ({ slotDirectory }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const seams = {
            slotDir: slotDirectory,
            limit: 1,
            waitBudgetMs: WAIT_BUDGET_MS,
            pollMs: POLL_MS,
            isInteractive: false,
          };
          yield* Effect.promise(() => runThrottle(FAILING_COMMAND, seams));
          return runThrottle(TRIVIAL_COMMAND, seams);
        }),
      ));

    it(
      "takes the slot the failed run released",
      { timeout: 30_000 },
      ({ theCodeOfARunFollowingAFailedOne }) => {
        expect(theCodeOfARunFollowingAFailedOne).toBe(0);
      },
    );
  });

  describe("a command that exits non-zero", () => {
    const it = test
      .extend("theCodeOfACommandThatExitedNonZero", ({ slotDirectory }) =>
        runThrottle(FAILING_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
        }))
      .extend("theExitCodeIsNamedOnStderr", ({ slotDirectory, stderr }) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            runThrottle(FAILING_COMMAND, {
              slotDir: slotDirectory,
              limit: 1,
              waitBudgetMs: WAIT_BUDGET_MS,
              pollMs: POLL_MS,
              isInteractive: false,
            }),
          );
          return stderr.text().includes("failed with exit code 3");
        }),
      );

    it(
      "is reported as a failure",
      { timeout: 30_000 },
      ({ theCodeOfACommandThatExitedNonZero }) => {
        expect(theCodeOfACommandThatExitedNonZero).toBe(1);
      },
    );

    it("names the exit code on stderr", { timeout: 30_000 }, ({ theExitCodeIsNamedOnStderr }) => {
      expect(theExitCodeIsNamedOnStderr).toBe(true);
    });
  });

  describe("a command killed by a signal", () => {
    const it = test
      .extend("theCodeOfACommandThatWasKilled", ({ slotDirectory }) =>
        runThrottle(SELF_KILLING_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
        }))
      .extend("theSignalIsNamedOnStderr", ({ slotDirectory, stderr }) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            runThrottle(SELF_KILLING_COMMAND, {
              slotDir: slotDirectory,
              limit: 1,
              waitBudgetMs: WAIT_BUDGET_MS,
              pollMs: POLL_MS,
              isInteractive: false,
            }),
          );
          return stderr.text().includes("was killed by SIGTERM");
        }),
      );

    it("is reported as a failure", { timeout: 30_000 }, ({ theCodeOfACommandThatWasKilled }) => {
      expect(theCodeOfACommandThatWasKilled).toBe(1);
    });

    it("names the signal on stderr", { timeout: 30_000 }, ({ theSignalIsNamedOnStderr }) => {
      expect(theSignalIsNamedOnStderr).toBe(true);
    });
  });

  describe("a command that cannot start", () => {
    const it = test
      .extend("theCodeOfACommandThatCouldNotStart", ({ slotDirectory }) =>
        runThrottle(["--", MISSING_EXECUTABLE], {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
        }))
      .extend("theUnstartableCommandIsNamedOnStderr", ({ slotDirectory, stderr }) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            runThrottle(["--", MISSING_EXECUTABLE], {
              slotDir: slotDirectory,
              limit: 1,
              waitBudgetMs: WAIT_BUDGET_MS,
              pollMs: POLL_MS,
              isInteractive: false,
            }),
          );
          return stderr.text().includes(`could not start ${MISSING_EXECUTABLE}`);
        }),
      );

    it(
      "is reported as a failure",
      { timeout: 30_000 },
      ({ theCodeOfACommandThatCouldNotStart }) => {
        expect(theCodeOfACommandThatCouldNotStart).toBe(1);
      },
    );

    it(
      "names the command on stderr",
      { timeout: 30_000 },
      ({ theUnstartableCommandIsNamedOnStderr }) => {
        expect(theUnstartableCommandIsNamedOnStderr).toBe(true);
      },
    );
  });

  describe("a command that runs past its timeout", () => {
    const TIMED_OUT_KILL_GRACE_MS = 100;
    const it = test
      .extend("theCodeOfACommandThatRanPastItsTimeout", ({ slotDirectory }) =>
        runThrottle(SLEEPING_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
          killGraceMs: TIMED_OUT_KILL_GRACE_MS,
        }))
      .extend("theTimeoutIsNamedOnStderr", ({ slotDirectory, stderr }) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            runThrottle(SLEEPING_COMMAND, {
              slotDir: slotDirectory,
              limit: 1,
              waitBudgetMs: WAIT_BUDGET_MS,
              pollMs: POLL_MS,
              isInteractive: false,
              killGraceMs: TIMED_OUT_KILL_GRACE_MS,
            }),
          );
          return stderr.text().includes("ran past the 1s timeout");
        }),
      )
      .extend("theTreeTerminationFailureIsNamedOnStderr", ({ slotDirectory, stderr }) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            runThrottle(SLEEPING_COMMAND, {
              slotDir: slotDirectory,
              limit: 1,
              waitBudgetMs: WAIT_BUDGET_MS,
              pollMs: POLL_MS,
              isInteractive: false,
              killGraceMs: TIMED_OUT_KILL_GRACE_MS,
            }),
          );
          return stderr.text().includes("could not terminate the whole command tree");
        }),
      );

    it(
      "is reported as a failure",
      { timeout: 30_000 },
      ({ theCodeOfACommandThatRanPastItsTimeout }) => {
        expect(theCodeOfACommandThatRanPastItsTimeout).toBe(1);
      },
    );

    it("names the timeout on stderr", { timeout: 30_000 }, ({ theTimeoutIsNamedOnStderr }) => {
      expect(theTimeoutIsNamedOnStderr).toBe(true);
    });

    it(
      "says nothing about a tree it could not terminate",
      { timeout: 30_000 },
      ({ theTreeTerminationFailureIsNamedOnStderr }) => {
        expect(theTreeTerminationFailureIsNamedOnStderr).toBe(false);
      },
    );
  });

  describe("a fast command under a long timeout", () => {
    const it = test
      .extend("theCodeOfAFastCommandUnderALongTimeout", () => {
        const settledChild = new ChildProcessWithKnownPid();
        return runWithSlot({
          invocation: {
            timeoutSec: 30,
            executable: process.execPath,
            args: ["-e", ""],
            commandLine: `${process.execPath} -e `,
          },
          hold: { release: () => Promise.resolve() },
          dependencies: {
            spawnChild: () => {
              queueMicrotask(() => settledChild.emit(CHILD_PROCESS_EVENT.exit, 0, null));
              return settledChild;
            },
            signalTree: () => null,
          },
        });
      })
      .extend("theSpawnOfAFastCommandUnderALongTimeout", () =>
        Effect.gen(function* () {
          const settledChild = new ChildProcessWithKnownPid();
          const spawnChild = vi.fn<
            (spawned: { executable: string; args: readonly string[] }) => FakeChildProcess
          >(() => {
            queueMicrotask(() => settledChild.emit(CHILD_PROCESS_EVENT.exit, 0, null));
            return settledChild;
          });
          yield* Effect.promise(() =>
            runWithSlot({
              invocation: {
                timeoutSec: 30,
                executable: process.execPath,
                args: ["-e", ""],
                commandLine: `${process.execPath} -e `,
              },
              hold: { release: () => Promise.resolve() },
              dependencies: { spawnChild, signalTree: () => null },
            }),
          );
          return spawnChild;
        }),
      )
      .extend("theSlotReleaseOfAFastCommandUnderALongTimeout", () =>
        Effect.gen(function* () {
          const settledChild = new ChildProcessWithKnownPid();
          const release = vi.fn<() => Promise<void>>(() => Promise.resolve());
          yield* Effect.promise(() =>
            runWithSlot({
              invocation: {
                timeoutSec: 30,
                executable: process.execPath,
                args: ["-e", ""],
                commandLine: `${process.execPath} -e `,
              },
              hold: { release },
              dependencies: {
                spawnChild: () => {
                  queueMicrotask(() => settledChild.emit(CHILD_PROCESS_EVENT.exit, 0, null));
                  return settledChild;
                },
                signalTree: () => null,
              },
            }),
          );
          return release;
        }),
      )
      .extend("theTreeSignalOfAFastCommandUnderALongTimeout", () =>
        Effect.gen(function* () {
          const settledChild = new ChildProcessWithKnownPid();
          const signalTree = vi.fn<
            (signalled: { pid: number; signal: NodeJS.Signals }) => Error | null
          >(() => null);
          yield* Effect.promise(() =>
            runWithSlot({
              invocation: {
                timeoutSec: 30,
                executable: process.execPath,
                args: ["-e", ""],
                commandLine: `${process.execPath} -e `,
              },
              hold: { release: () => Promise.resolve() },
              dependencies: {
                spawnChild: () => {
                  queueMicrotask(() => settledChild.emit(CHILD_PROCESS_EVENT.exit, 0, null));
                  return settledChild;
                },
                signalTree,
              },
            }),
          );
          return signalTree;
        }),
      );

    it("is reported as a pass", ({ theCodeOfAFastCommandUnderALongTimeout }) => {
      expect(theCodeOfAFastCommandUnderALongTimeout).toBe(0);
    });

    it("starts the command once", ({ theSpawnOfAFastCommandUnderALongTimeout }) => {
      expect(theSpawnOfAFastCommandUnderALongTimeout).toHaveBeenCalledOnce();
    });

    it("gives the slot back once", ({ theSlotReleaseOfAFastCommandUnderALongTimeout }) => {
      expect(theSlotReleaseOfAFastCommandUnderALongTimeout).toHaveBeenCalledOnce();
    });

    it("returns without the timeout that never fires reaching the tree", ({
      theTreeSignalOfAFastCommandUnderALongTimeout,
    }) => {
      expect(theTreeSignalOfAFastCommandUnderALongTimeout).toHaveBeenCalledTimes(0);
    });
  });

  describe("a grandchild that survives SIGTERM after the root exits", () => {
    const GRANDCHILD_KILL_GRACE_MS = 100;
    const it = test
      .extend("stampsDirectory", ({}, { onCleanup }) => {
        const madeStampsDirectory = makeTempDirectory("throttle-tree-stamps-");
        onCleanup(() => {
          removePath(madeStampsDirectory);
        });
        return madeStampsDirectory;
      })
      .extend("theCodeOfARunWithASurvivingGrandchild", ({ slotDirectory, stampsDirectory }) => {
        const pidFile = joinPath(stampsDirectory, "grandchild-pid");
        return runThrottle(
          [
            "--timeout",
            "1",
            "--",
            process.execPath,
            "-e",
            `const { spawn } = require("node:child_process"); const { writeFileSync } = require("node:fs"); const grandchild = spawnChild({ executable: process.execPath, handed:  ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"], spawnOptions:  { stdio: "ignore" } }); writeFileString({ location: ${JSON.stringify(pidFile)}, written:  String(grandchild.pid) }); setInterval(() => {}, 1000);`,
          ],
          {
            slotDir: slotDirectory,
            limit: 1,
            waitBudgetMs: WAIT_BUDGET_MS,
            pollMs: POLL_MS,
            isInteractive: false,
            killGraceMs: GRANDCHILD_KILL_GRACE_MS,
          },
        );
      })
      .extend(
        "theSurvivingGrandchildTimeoutIsNamedOnStderr",
        ({ slotDirectory, stampsDirectory, stderr }) =>
          Effect.gen(function* () {
            const pidFile = joinPath(stampsDirectory, "grandchild-pid");
            yield* Effect.promise(() =>
              runThrottle(
                [
                  "--timeout",
                  "1",
                  "--",
                  process.execPath,
                  "-e",
                  `const { spawn } = require("node:child_process"); const { writeFileSync } = require("node:fs"); const grandchild = spawnChild({ executable: process.execPath, handed:  ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"], spawnOptions:  { stdio: "ignore" } }); writeFileString({ location: ${JSON.stringify(pidFile)}, written:  String(grandchild.pid) }); setInterval(() => {}, 1000);`,
                ],
                {
                  slotDir: slotDirectory,
                  limit: 1,
                  waitBudgetMs: WAIT_BUDGET_MS,
                  pollMs: POLL_MS,
                  isInteractive: false,
                  killGraceMs: GRANDCHILD_KILL_GRACE_MS,
                },
              ),
            );
            return stderr.text().includes("ran past the 1s timeout");
          }),
      )
      .extend("theEscalationOutlastedTheTimeout", ({ slotDirectory, stampsDirectory }) =>
        Effect.gen(function* () {
          const pidFile = joinPath(stampsDirectory, "grandchild-pid");
          const before = epochMillis();
          yield* Effect.promise(() =>
            runThrottle(
              [
                "--timeout",
                "1",
                "--",
                process.execPath,
                "-e",
                `const { spawn } = require("node:child_process"); const { writeFileSync } = require("node:fs"); const grandchild = spawnChild({ executable: process.execPath, handed:  ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"], spawnOptions:  { stdio: "ignore" } }); writeFileString({ location: ${JSON.stringify(pidFile)}, written:  String(grandchild.pid) }); setInterval(() => {}, 1000);`,
              ],
              {
                slotDir: slotDirectory,
                limit: 1,
                waitBudgetMs: WAIT_BUDGET_MS,
                pollMs: POLL_MS,
                isInteractive: false,
                killGraceMs: GRANDCHILD_KILL_GRACE_MS,
              },
            ),
          );
          return epochMillis() - before > 1_000 + GRANDCHILD_KILL_GRACE_MS;
        }),
      )
      .extend("theProbeOfTheGrandchild", ({ slotDirectory, stampsDirectory }) =>
        Effect.gen(function* () {
          const pidFile = joinPath(stampsDirectory, "grandchild-pid");
          yield* Effect.promise(() =>
            runThrottle(
              [
                "--timeout",
                "1",
                "--",
                process.execPath,
                "-e",
                `const { spawn } = require("node:child_process"); const { writeFileSync } = require("node:fs"); const grandchild = spawnChild({ executable: process.execPath, handed:  ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"], spawnOptions:  { stdio: "ignore" } }); writeFileString({ location: ${JSON.stringify(pidFile)}, written:  String(grandchild.pid) }); setInterval(() => {}, 1000);`,
              ],
              {
                slotDir: slotDirectory,
                limit: 1,
                waitBudgetMs: WAIT_BUDGET_MS,
                pollMs: POLL_MS,
                isInteractive: false,
                killGraceMs: GRANDCHILD_KILL_GRACE_MS,
              },
            ),
          );
          yield* Effect.promise(() => delay(200));
          try {
            process.kill(Number(readFileString(pidFile).trim()), 0);
            throw new Error("the grandchild was still alive after the timeout");
          } catch (probedGrandchild) {
            return probedGrandchild instanceof Error
              ? probedGrandchild.message
              : String(probedGrandchild);
          }
        }),
      );

    it(
      "is reported as a failure",
      { timeout: 50_000 },
      ({ theCodeOfARunWithASurvivingGrandchild }) => {
        expect(theCodeOfARunWithASurvivingGrandchild).toBe(1);
      },
    );

    it(
      "names the timeout on stderr",
      { timeout: 50_000 },
      ({ theSurvivingGrandchildTimeoutIsNamedOnStderr }) => {
        expect(theSurvivingGrandchildTimeoutIsNamedOnStderr).toBe(true);
      },
    );

    it(
      "waits past the timeout before escalating to SIGKILL",
      { timeout: 50_000 },
      ({ theEscalationOutlastedTheTimeout }) => {
        expect(theEscalationOutlastedTheTimeout).toBe(true);
      },
    );

    it("leaves no grandchild behind", { timeout: 50_000 }, ({ theProbeOfTheGrandchild }) => {
      expect(theProbeOfTheGrandchild).toBe("kill ESRCH");
    });
  });

  describe("a timeout on a platform whose tree dies without a grace period", () => {
    const it = test
      .extend("theCodeOfARunTimedOutWithoutAGracePeriod", () => {
        const lingeringChild = new ChildProcessWithKnownPid();
        return runWithSlot({
          invocation: {
            timeoutSec: 1,
            executable: process.execPath,
            args: LINGERING_ARGUMENTS,
            commandLine: `${process.execPath} -e setInterval`,
          },
          hold: { release: () => Promise.resolve() },
          dependencies: {
            platform: "win32",
            spawnChild: () => lingeringChild,
            signalTree: () => {
              lingeringChild.emit(CHILD_PROCESS_EVENT.exit, null, TREE_TERMINATION_SIGNAL.forced);
              return null;
            },
          },
        });
      })
      .extend("theTreeSignalOfARunTimedOutWithoutAGracePeriod", () =>
        Effect.gen(function* () {
          const lingeringChild = new ChildProcessWithKnownPid();
          const signalTree = vi.fn<
            (signalled: { pid: number; signal: NodeJS.Signals }) => Error | null
          >(() => {
            lingeringChild.emit(CHILD_PROCESS_EVENT.exit, null, TREE_TERMINATION_SIGNAL.forced);
            return null;
          });
          yield* Effect.promise(() =>
            runWithSlot({
              invocation: {
                timeoutSec: 1,
                executable: process.execPath,
                args: LINGERING_ARGUMENTS,
                commandLine: `${process.execPath} -e setInterval`,
              },
              hold: { release: () => Promise.resolve() },
              dependencies: {
                platform: "win32",
                spawnChild: () => lingeringChild,
                signalTree,
              },
            }),
          );
          return signalTree;
        }),
      )
      .extend("theRunTimedOutWithoutAGracePeriodEndedPromptly", () =>
        Effect.gen(function* () {
          const lingeringChild = new ChildProcessWithKnownPid();
          const before = epochMillis();
          yield* Effect.promise(() =>
            runWithSlot({
              invocation: {
                timeoutSec: 1,
                executable: process.execPath,
                args: LINGERING_ARGUMENTS,
                commandLine: `${process.execPath} -e setInterval`,
              },
              hold: { release: () => Promise.resolve() },
              dependencies: {
                platform: "win32",
                spawnChild: () => lingeringChild,
                signalTree: () => {
                  lingeringChild.emit(
                    CHILD_PROCESS_EVENT.exit,
                    null,
                    TREE_TERMINATION_SIGNAL.forced,
                  );
                  return null;
                },
              },
            }),
          );
          return epochMillis() - before < 10_000;
        }),
      )
      .extend("theTimeoutWithoutAGracePeriodIsNamedOnStderr", ({ stderr }) =>
        Effect.gen(function* () {
          const lingeringChild = new ChildProcessWithKnownPid();
          yield* Effect.promise(() =>
            runWithSlot({
              invocation: {
                timeoutSec: 1,
                executable: process.execPath,
                args: LINGERING_ARGUMENTS,
                commandLine: `${process.execPath} -e setInterval`,
              },
              hold: { release: () => Promise.resolve() },
              dependencies: {
                platform: "win32",
                spawnChild: () => lingeringChild,
                signalTree: () => {
                  lingeringChild.emit(
                    CHILD_PROCESS_EVENT.exit,
                    null,
                    TREE_TERMINATION_SIGNAL.forced,
                  );
                  return null;
                },
              },
            }),
          );
          return stderr.text().includes("ran past the 1s timeout");
        }),
      );

    it("is reported as a failure", ({ theCodeOfARunTimedOutWithoutAGracePeriod }) => {
      expect(theCodeOfARunTimedOutWithoutAGracePeriod).toBe(1);
    });

    it("forces the whole tree down in a single signal", ({
      theTreeSignalOfARunTimedOutWithoutAGracePeriod,
    }) => {
      expect(theTreeSignalOfARunTimedOutWithoutAGracePeriod).toHaveBeenCalledExactlyOnceWith({
        pid: KNOWN_CHILD_PID,
        signal: TREE_TERMINATION_SIGNAL.forced,
      });
    });

    it("ends without waiting out a grace period", ({
      theRunTimedOutWithoutAGracePeriodEndedPromptly,
    }) => {
      expect(theRunTimedOutWithoutAGracePeriodEndedPromptly).toBe(true);
    });

    it("names the timeout on stderr", ({ theTimeoutWithoutAGracePeriodIsNamedOnStderr }) => {
      expect(theTimeoutWithoutAGracePeriodIsNamedOnStderr).toBe(true);
    });
  });

  describe("a process tree that could not be terminated while its root stopped", () => {
    const it = test
      .extend("theCodeOfARunWhoseTreeSurvived", () => {
        const lingeringChild = new ChildProcessWithKnownPid();
        return runWithSlot({
          invocation: {
            timeoutSec: 1,
            executable: process.execPath,
            args: LINGERING_ARGUMENTS,
            commandLine: `${process.execPath} -e setInterval`,
          },
          hold: { release: () => Promise.resolve() },
          dependencies: {
            platform: "win32",
            spawnChild: () => lingeringChild,
            signalTree: () => {
              lingeringChild.emit(CHILD_PROCESS_EVENT.exit, null, TREE_TERMINATION_SIGNAL.forced);
              return new Error("taskkill denied");
            },
          },
        });
      })
      .extend("theSurvivingTreeIsNamedOnStderr", ({ stderr }) =>
        Effect.gen(function* () {
          const lingeringChild = new ChildProcessWithKnownPid();
          yield* Effect.promise(() =>
            runWithSlot({
              invocation: {
                timeoutSec: 1,
                executable: process.execPath,
                args: LINGERING_ARGUMENTS,
                commandLine: `${process.execPath} -e setInterval`,
              },
              hold: { release: () => Promise.resolve() },
              dependencies: {
                platform: "win32",
                spawnChild: () => lingeringChild,
                signalTree: () => {
                  lingeringChild.emit(
                    CHILD_PROCESS_EVENT.exit,
                    null,
                    TREE_TERMINATION_SIGNAL.forced,
                  );
                  return new Error("taskkill denied");
                },
              },
            }),
          );
          return stderr
            .text()
            .includes("could not terminate the whole command tree: taskkill denied");
        }),
      )
      .extend("theTimeoutBehindTheSurvivingTreeIsNamedOnStderr", ({ stderr }) =>
        Effect.gen(function* () {
          const lingeringChild = new ChildProcessWithKnownPid();
          yield* Effect.promise(() =>
            runWithSlot({
              invocation: {
                timeoutSec: 1,
                executable: process.execPath,
                args: LINGERING_ARGUMENTS,
                commandLine: `${process.execPath} -e setInterval`,
              },
              hold: { release: () => Promise.resolve() },
              dependencies: {
                platform: "win32",
                spawnChild: () => lingeringChild,
                signalTree: () => {
                  lingeringChild.emit(
                    CHILD_PROCESS_EVENT.exit,
                    null,
                    TREE_TERMINATION_SIGNAL.forced,
                  );
                  return new Error("taskkill denied");
                },
              },
            }),
          );
          return stderr.text().includes("ran past the 1s timeout");
        }),
      );

    it("is reported as a failure", ({ theCodeOfARunWhoseTreeSurvived }) => {
      expect(theCodeOfARunWhoseTreeSurvived).toBe(1);
    });

    it("names the tree it could not terminate", ({ theSurvivingTreeIsNamedOnStderr }) => {
      expect(theSurvivingTreeIsNamedOnStderr).toBe(true);
    });

    it("still names the timeout that started the termination", ({
      theTimeoutBehindTheSurvivingTreeIsNamedOnStderr,
    }) => {
      expect(theTimeoutBehindTheSurvivingTreeIsNamedOnStderr).toBe(true);
    });
  });

  describe("a slot that refuses to be given back after a command that passed", () => {
    const it = test
      .extend("theCodeOfAPassingRunWhoseSlotStuck", () =>
        runWithSlot({
          invocation: {
            timeoutSec: 0,
            executable: process.execPath,
            args: ["-e", ""],
            commandLine: `${process.execPath} -e `,
          },
          hold: { release: () => Promise.reject(new Error("unlock failed")) },
        }))
      .extend("theSlotReleaseOfAPassingRunWhoseSlotStuck", () =>
        Effect.gen(function* () {
          const release = vi.fn<() => Promise<void>>(() =>
            Promise.reject(new Error("unlock failed")),
          );
          yield* Effect.promise(() =>
            runWithSlot({
              invocation: {
                timeoutSec: 0,
                executable: process.execPath,
                args: ["-e", ""],
                commandLine: `${process.execPath} -e `,
              },
              hold: { release },
            }),
          );
          return release;
        }),
      )
      .extend("theStuckSlotIsNamedOnStderr", ({ stderr }) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            runWithSlot({
              invocation: {
                timeoutSec: 0,
                executable: process.execPath,
                args: ["-e", ""],
                commandLine: `${process.execPath} -e `,
              },
              hold: { release: () => Promise.reject(new Error("unlock failed")) },
            }),
          );
          return stderr.text().includes("could not release the slot: unlock failed");
        }),
      );

    it("turns a passing command into a failure", ({ theCodeOfAPassingRunWhoseSlotStuck }) => {
      expect(theCodeOfAPassingRunWhoseSlotStuck).toBe(1);
    });

    it("asks for the slot back once", ({ theSlotReleaseOfAPassingRunWhoseSlotStuck }) => {
      expect(theSlotReleaseOfAPassingRunWhoseSlotStuck).toHaveBeenCalledOnce();
    });

    it("names the refusal on stderr", ({ theStuckSlotIsNamedOnStderr }) => {
      expect(theStuckSlotIsNamedOnStderr).toBe(true);
    });
  });

  describe("a slot that refuses to be given back after a command that failed", () => {
    const it = test
      .extend("theCodeOfAFailingRunWhoseSlotStuck", () =>
        runWithSlot({
          invocation: {
            timeoutSec: 0,
            executable: process.execPath,
            args: ["-e", "process.exit(3);"],
            commandLine: `${process.execPath} -e process.exit(3);`,
          },
          hold: { release: () => Promise.reject(new Error("close failed")) },
        }))
      .extend("theExitCodeBehindAStuckSlotIsNamedOnStderr", ({ stderr }) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            runWithSlot({
              invocation: {
                timeoutSec: 0,
                executable: process.execPath,
                args: ["-e", "process.exit(3);"],
                commandLine: `${process.execPath} -e process.exit(3);`,
              },
              hold: { release: () => Promise.reject(new Error("close failed")) },
            }),
          );
          return stderr.text().includes("command failed with exit code 3");
        }),
      )
      .extend("theStuckSlotBehindAFailedCommandIsNamedOnStderr", ({ stderr }) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            runWithSlot({
              invocation: {
                timeoutSec: 0,
                executable: process.execPath,
                args: ["-e", "process.exit(3);"],
                commandLine: `${process.execPath} -e process.exit(3);`,
              },
              hold: { release: () => Promise.reject(new Error("close failed")) },
            }),
          );
          return stderr.text().includes("could not release the slot: close failed");
        }),
      );

    it("is reported as a failure", ({ theCodeOfAFailingRunWhoseSlotStuck }) => {
      expect(theCodeOfAFailingRunWhoseSlotStuck).toBe(1);
    });

    it("still names the exit code of the command", ({
      theExitCodeBehindAStuckSlotIsNamedOnStderr,
    }) => {
      expect(theExitCodeBehindAStuckSlotIsNamedOnStderr).toBe(true);
    });

    it("names the refusal beside the command failure", ({
      theStuckSlotBehindAFailedCommandIsNamedOnStderr,
    }) => {
      expect(theStuckSlotBehindAFailedCommandIsNamedOnStderr).toBe(true);
    });
  });

  describe("a slot whose refusal is not an error", () => {
    const it = test
      .extend("theCodeOfARunRefusedWithoutAnError", () =>
        runWithSlot({
          invocation: {
            timeoutSec: 0,
            executable: process.execPath,
            args: ["-e", ""],
            commandLine: `${process.execPath} -e `,
          },
          hold: {
            release: () => {
              const pending = Promise.withResolvers<undefined>();
              Reflect.apply(pending.reject, undefined, ["unlock failed"]);
              return pending.promise;
            },
          },
        }))
      .extend("theRefusalWithoutAnErrorIsNamedOnStderr", ({ stderr }) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            runWithSlot({
              invocation: {
                timeoutSec: 0,
                executable: process.execPath,
                args: ["-e", ""],
                commandLine: `${process.execPath} -e `,
              },
              hold: {
                release: () => {
                  const pending = Promise.withResolvers<undefined>();
                  Reflect.apply(pending.reject, undefined, ["unlock failed"]);
                  return pending.promise;
                },
              },
            }),
          );
          return stderr.text().includes("could not release the slot: unlock failed");
        }),
      );

    it("is reported as a failure", ({ theCodeOfARunRefusedWithoutAnError }) => {
      expect(theCodeOfARunRefusedWithoutAnError).toBe(1);
    });

    it("renders the thrown value on stderr", ({ theRefusalWithoutAnErrorIsNamedOnStderr }) => {
      expect(theRefusalWithoutAnErrorIsNamedOnStderr).toBe(true);
    });
  });

  describe("everything a run of an unstartable command says", () => {
    const it = test.extend("theRunOfAnUnstartableCommand", { auto: true }, ({ slotDirectory }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            runThrottle(["--", MISSING_EXECUTABLE], {
              slotDir: slotDirectory,
              limit: 1,
              waitBudgetMs: WAIT_BUDGET_MS,
              pollMs: POLL_MS,
              isInteractive: false,
            }),
          );
        }),
      ),
    );

    it("says nothing on stdout", { timeout: 30_000 }, ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [],
        }
      `);
    });

    it("tells the whole run on stderr", { timeout: 30_000 }, ({ stderr }) => {
      expect(stderr).toMatchInlineSnapshot(`
        {
          "chunks": [
            "throttle: acquiring a slot (limit 1)
        ",
            "throttle: run /no/such/executable-for-throttle
        ",
            "throttle: could not start /no/such/executable-for-throttle: spawn /no/such/executable-for-throttle ENOENT
        ",
          ],
        }
      `);
    });
  });
});
