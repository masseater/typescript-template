import { Effect } from "effect";
import { describe, expect, test, vi } from "vite-plus/test";

import { signalProcessTree } from "./process-tree.ts";

type SignalTreeInput = Parameters<typeof signalProcessTree>[0];
type TaskkillExecutor = NonNullable<
  NonNullable<SignalTreeInput["dependencies"]>["executeTaskkill"]
>;

describe("signalProcessTree", () => {
  describe("a Windows tree that taskkill accepted", () => {
    const it = test
      .extend("theOutcomeOfATaskkillThatAccepted", () => {
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => Effect.succeed({ status: 0 }));
        return Effect.runSync(
          signalProcessTree({
            pid: 4321,
            signal: "SIGTERM",
            dependencies: { platform: "win32", executeTaskkill },
          }),
        );
      })
      .extend("theTaskkillInvocationOfAnAcceptedTree", () => {
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => Effect.succeed({ status: 0 }));
        Effect.runSync(
          signalProcessTree({
            pid: 4321,
            signal: "SIGTERM",
            dependencies: { platform: "win32", executeTaskkill },
          }),
        );
        return executeTaskkill;
      });

    it("reports no failure", ({ theOutcomeOfATaskkillThatAccepted }) => {
      expect(theOutcomeOfATaskkillThatAccepted).toBe(null);
    });

    it("hands taskkill one literal pid and the forceful tree flags", ({
      theTaskkillInvocationOfAnAcceptedTree,
    }) => {
      expect(theTaskkillInvocationOfAnAcceptedTree).toHaveBeenCalledWith({
        executable: "taskkill",
        handedArguments: ["/PID", "4321", "/T", "/F"],
      });
    });
  });

  describe("a taskkill that never started", () => {
    const it = test.extend("theOutcomeOfATaskkillThatNeverStartedIsTheStartFailure", () => {
      const startFailure = new Error("taskkill missing");
      return (
        Effect.runSync(
          signalProcessTree({
            pid: 4321,
            signal: "SIGTERM",
            dependencies: {
              platform: "win32",
              executeTaskkill: () => Effect.succeed({ error: startFailure, status: null }),
              signalProcess: () => null,
            },
          }),
        ) === startFailure
      );
    });

    it("hands back the failure that kept taskkill from starting", ({
      theOutcomeOfATaskkillThatNeverStartedIsTheStartFailure,
    }) => {
      expect(theOutcomeOfATaskkillThatNeverStartedIsTheStartFailure).toBe(true);
    });
  });

  describe("a taskkill that exited with a code", () => {
    const it = test.extend("theOutcomeOfATaskkillThatExitedWithACode", () =>
      Effect.runSync(
        signalProcessTree({
          pid: 4321,
          signal: "SIGTERM",
          dependencies: {
            platform: "win32",
            executeTaskkill: () => Effect.succeed({ status: 5 }),
            signalProcess: () => null,
          },
        }),
      ));

    it("names the exit code in the failure", ({ theOutcomeOfATaskkillThatExitedWithACode }) => {
      expect(theOutcomeOfATaskkillThatExitedWithACode).toStrictEqual(
        new Error("taskkill exited with code 5"),
      );
    });
  });

  describe("a taskkill that exited without a code", () => {
    const it = test.extend("theOutcomeOfATaskkillThatExitedWithoutACode", () =>
      Effect.runSync(
        signalProcessTree({
          pid: 4321,
          signal: "SIGTERM",
          dependencies: {
            platform: "win32",
            executeTaskkill: () => Effect.succeed({ status: null }),
            signalProcess: () => null,
          },
        }),
      ));

    it("calls the missing exit code unknown", ({ theOutcomeOfATaskkillThatExitedWithoutACode }) => {
      expect(theOutcomeOfATaskkillThatExitedWithoutACode).toStrictEqual(
        new Error("taskkill exited with code unknown"),
      );
    });
  });

  describe("the native taskkill invocation aimed at a nonexistent process", () => {
    const it = test.extend("theNativeTaskkillOutcomeForANonexistentProcessIsAFailure", () =>
      Effect.runPromise(
        signalProcessTree({
          pid: 999_999_999,
          signal: "SIGTERM",
          dependencies: { platform: "win32" },
        }).pipe(Effect.map((nativeTaskkillFailure) => nativeTaskkillFailure instanceof Error)),
      ));

    it("reports the nonexistent process as a failure", ({
      theNativeTaskkillOutcomeForANonexistentProcessIsAFailure,
    }) => {
      expect(theNativeTaskkillOutcomeForANonexistentProcessIsAFailure).toBe(true);
    });
  });

  describe("a POSIX process group that took the signal", () => {
    const it = test
      .extend("theOutcomeOfASignalledPosixProcessGroup", () => {
        const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(
          () => null,
        );
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => Effect.succeed({ status: 0 }));
        return Effect.runSync(
          signalProcessTree({
            pid: 4321,
            signal: "SIGTERM",
            dependencies: { platform: "linux", signalProcess, executeTaskkill },
          }),
        );
      })
      .extend("theProcessSignalsOfASignalledPosixProcessGroup", () => {
        const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(
          () => null,
        );
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => Effect.succeed({ status: 0 }));
        Effect.runSync(
          signalProcessTree({
            pid: 4321,
            signal: "SIGTERM",
            dependencies: { platform: "linux", signalProcess, executeTaskkill },
          }),
        );
        return signalProcess;
      })
      .extend("theTaskkillInvocationsOfASignalledPosixProcessGroup", () => {
        const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(
          () => null,
        );
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => Effect.succeed({ status: 0 }));
        Effect.runSync(
          signalProcessTree({
            pid: 4321,
            signal: "SIGTERM",
            dependencies: { platform: "linux", signalProcess, executeTaskkill },
          }),
        );
        return executeTaskkill;
      });

    it("reports no failure", ({ theOutcomeOfASignalledPosixProcessGroup }) => {
      expect(theOutcomeOfASignalledPosixProcessGroup).toBe(null);
    });

    it("signals the group behind the negated pid", ({
      theProcessSignalsOfASignalledPosixProcessGroup,
    }) => {
      expect(theProcessSignalsOfASignalledPosixProcessGroup).toHaveBeenCalledWith(-4321, "SIGTERM");
    });

    it("never signals the root on its own", ({
      theProcessSignalsOfASignalledPosixProcessGroup,
    }) => {
      expect(theProcessSignalsOfASignalledPosixProcessGroup).toHaveBeenCalledTimes(1);
    });

    it("leaves taskkill untouched", ({ theTaskkillInvocationsOfASignalledPosixProcessGroup }) => {
      expect(theTaskkillInvocationsOfASignalledPosixProcessGroup).toHaveBeenCalledTimes(0);
    });
  });

  describe("a Windows tree handed over as a whole", () => {
    const it = test
      .extend("theOutcomeOfAWindowsTreeHandedOverAsAWhole", () => {
        const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(
          () => null,
        );
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => Effect.succeed({ status: 0 }));
        return Effect.runSync(
          signalProcessTree({
            pid: 4321,
            signal: "SIGTERM",
            dependencies: { platform: "win32", signalProcess, executeTaskkill },
          }),
        );
      })
      .extend("theTaskkillInvocationsOfAWindowsTreeHandedOverAsAWhole", () => {
        const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(
          () => null,
        );
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => Effect.succeed({ status: 0 }));
        Effect.runSync(
          signalProcessTree({
            pid: 4321,
            signal: "SIGTERM",
            dependencies: { platform: "win32", signalProcess, executeTaskkill },
          }),
        );
        return executeTaskkill;
      })
      .extend("theProcessSignalsOfAWindowsTreeHandedOverAsAWhole", () => {
        const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(
          () => null,
        );
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => Effect.succeed({ status: 0 }));
        Effect.runSync(
          signalProcessTree({
            pid: 4321,
            signal: "SIGTERM",
            dependencies: { platform: "win32", signalProcess, executeTaskkill },
          }),
        );
        return signalProcess;
      });

    it("reports no failure", ({ theOutcomeOfAWindowsTreeHandedOverAsAWhole }) => {
      expect(theOutcomeOfAWindowsTreeHandedOverAsAWhole).toBe(null);
    });

    it("delegates the whole tree to taskkill once", ({
      theTaskkillInvocationsOfAWindowsTreeHandedOverAsAWhole,
    }) => {
      expect(theTaskkillInvocationsOfAWindowsTreeHandedOverAsAWhole).toHaveBeenCalledTimes(1);
    });

    it("signals no process itself", ({ theProcessSignalsOfAWindowsTreeHandedOverAsAWhole }) => {
      expect(theProcessSignalsOfAWindowsTreeHandedOverAsAWhole).toHaveBeenCalledTimes(0);
    });
  });

  describe("a POSIX group that refused the signal while its root took it", () => {
    const it = test
      .extend("theOutcomeOfAPosixGroupThatRefusedIsTheGroupFailure", () => {
        const groupFailure = new Error("group missing");
        const signalProcess = vi
          .fn<(pid: number, signal: NodeJS.Signals) => Error | null>()
          .mockReturnValueOnce(groupFailure)
          .mockReturnValueOnce(null);
        return (
          Effect.runSync(
            signalProcessTree({
              pid: 4321,
              signal: "SIGTERM",
              dependencies: {
                platform: "darwin",
                signalProcess,
                executeTaskkill: () => Effect.succeed({ status: 0 }),
              },
            }),
          ) === groupFailure
        );
      })
      .extend("theProcessSignalsOfAPosixGroupThatRefused", () => {
        const signalProcess = vi
          .fn<(pid: number, signal: NodeJS.Signals) => Error | null>()
          .mockReturnValueOnce(new Error("group missing"))
          .mockReturnValueOnce(null);
        Effect.runSync(
          signalProcessTree({
            pid: 4321,
            signal: "SIGTERM",
            dependencies: {
              platform: "darwin",
              signalProcess,
              executeTaskkill: () => Effect.succeed({ status: 0 }),
            },
          }),
        );
        return signalProcess;
      });

    it("keeps the group failure observable", ({
      theOutcomeOfAPosixGroupThatRefusedIsTheGroupFailure,
    }) => {
      expect(theOutcomeOfAPosixGroupThatRefusedIsTheGroupFailure).toBe(true);
    });

    it("aims the first signal at the group", ({ theProcessSignalsOfAPosixGroupThatRefused }) => {
      expect(theProcessSignalsOfAPosixGroupThatRefused).toHaveBeenNthCalledWith(
        1,
        -4321,
        "SIGTERM",
      );
    });

    it("falls back to the root with the same signal", ({
      theProcessSignalsOfAPosixGroupThatRefused,
    }) => {
      expect(theProcessSignalsOfAPosixGroupThatRefused).toHaveBeenNthCalledWith(2, 4321, "SIGTERM");
    });
  });

  describe("a POSIX group and root that are both gone", () => {
    const it = test.extend("theOutcomeOfAPosixGroupAndRootThatAreBothGone", () => {
      const missingProcess: Error & { code: "ESRCH" } = {
        name: "Error",
        message: "missing",
        code: "ESRCH",
      };
      return Effect.runSync(
        signalProcessTree({
          pid: 4321,
          signal: "SIGKILL",
          dependencies: {
            platform: "darwin",
            signalProcess: () => missingProcess,
            executeTaskkill: () => Effect.succeed({ status: 0 }),
          },
        }),
      );
    });

    it("treats the shutdown as already completed", ({
      theOutcomeOfAPosixGroupAndRootThatAreBothGone,
    }) => {
      expect(theOutcomeOfAPosixGroupAndRootThatAreBothGone).toBe(null);
    });
  });

  describe("a Windows taskkill that was denied while the root took the signal", () => {
    const it = test
      .extend("theOutcomeOfADeniedTaskkillIsTheTaskkillFailure", () => {
        const taskkillFailure = new Error("taskkill denied");
        return (
          Effect.runSync(
            signalProcessTree({
              pid: 4321,
              signal: "SIGTERM",
              dependencies: {
                platform: "win32",
                signalProcess: () => null,
                executeTaskkill: () => Effect.succeed({ error: taskkillFailure, status: null }),
              },
            }),
          ) === taskkillFailure
        );
      })
      .extend("theProcessSignalsOfADeniedTaskkill", () => {
        const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(
          () => null,
        );
        Effect.runSync(
          signalProcessTree({
            pid: 4321,
            signal: "SIGTERM",
            dependencies: {
              platform: "win32",
              signalProcess,
              executeTaskkill: () =>
                Effect.succeed({ error: new Error("taskkill denied"), status: null }),
            },
          }),
        );
        return signalProcess;
      });

    it("keeps the taskkill failure observable", ({
      theOutcomeOfADeniedTaskkillIsTheTaskkillFailure,
    }) => {
      expect(theOutcomeOfADeniedTaskkillIsTheTaskkillFailure).toBe(true);
    });

    it("force-kills the root on its own", ({ theProcessSignalsOfADeniedTaskkill }) => {
      expect(theProcessSignalsOfADeniedTaskkill).toHaveBeenCalledWith(4321, "SIGKILL");
    });
  });

  describe("a tree and a root that both refused termination", () => {
    const it = test
      .extend("theOutcomeOfATreeAndRootThatBothRefusedIsAnAggregate", () => {
        const bothRefused = Effect.runSync(
          signalProcessTree({
            pid: 4321,
            signal: "SIGKILL",
            dependencies: {
              platform: "win32",
              signalProcess: () => new Error("root denied"),
              executeTaskkill: () =>
                Effect.succeed({ error: new Error("tree denied"), status: null }),
            },
          }),
        );
        return bothRefused instanceof AggregateError;
      })
      .extend("theRefusalsGatheredFromATreeAndItsRoot", () => {
        const bothRefused = Effect.runSync(
          signalProcessTree({
            pid: 4321,
            signal: "SIGKILL",
            dependencies: {
              platform: "win32",
              signalProcess: () => new Error("root denied"),
              executeTaskkill: () =>
                Effect.succeed({ error: new Error("tree denied"), status: null }),
            },
          }),
        );
        return bothRefused instanceof AggregateError ? bothRefused.errors : null;
      });

    it("gathers both refusals into one failure", ({
      theOutcomeOfATreeAndRootThatBothRefusedIsAnAggregate,
    }) => {
      expect(theOutcomeOfATreeAndRootThatBothRefusedIsAnAggregate).toBe(true);
    });

    it("preserves the tree refusal ahead of the root refusal", ({
      theRefusalsGatheredFromATreeAndItsRoot,
    }) => {
      expect(theRefusalsGatheredFromATreeAndItsRoot).toStrictEqual([
        new Error("tree denied"),
        new Error("root denied"),
      ]);
    });
  });
});
