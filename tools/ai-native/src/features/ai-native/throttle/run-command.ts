import { Effect, type Scope } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { attemptAsync } from "es-toolkit";

import { childEndOf } from "../child-process.ts";
import { nativeFailure, spawner } from "../host.ts";
import { signalProcessTree, TREE_TERMINATION_SIGNAL } from "./process-tree.ts";
import { DELAY_ENDING, settledDelay } from "./settled-delay.ts";
import {
  dropInterruptHandler,
  installInterruptHandler,
  makeHeldInterrupt,
  makeRunningInterruptHandler,
} from "./signals.ts";
import { warnUnreleased } from "./unreleased-warning.ts";

import type { SlotHold } from "./slots.ts";
import type { Invocation } from "./usage.ts";

const KILL_GRACE_MS = 5_000;

type ChildExit = {
  kind: "exit";
  exitCode: number | null;
  bySignal: NodeJS.Signals | null;
};

type CommandChild = {
  readonly pid: number;
  readonly exited: Effect.Effect<ChildExit>;
};

type RunCommandDependencies = {
  platform: NodeJS.Platform;
  signalTree: (input: { pid: number; signal: NodeJS.Signals }) => Effect.Effect<Error | null>;
  spawnChild: (input: {
    executable: string;
    args: readonly string[];
    killGraceMs: number;
  }) => Effect.Effect<CommandChild, Error, Scope.Scope>;
  killGraceMs: number;
};

const timeoutFired = (parameters: {
  childPid: number;
  timeoutMs: number;
  cancel: AbortSignal;
  dependencies: RunCommandDependencies;
}): Promise<{ fired: boolean; terminationFailure: Error | null }> =>
  Effect.runPromise(
    Effect.gen(function* fireTimeout() {
      const beforeTimeout = yield* Effect.promise(() =>
        settledDelay(parameters.timeoutMs, parameters.cancel),
      );
      if (beforeTimeout === DELAY_ENDING.cancelled) {
        return { fired: false, terminationFailure: null };
      }
      const firstSignal =
        parameters.dependencies.platform === "win32"
          ? TREE_TERMINATION_SIGNAL.forced
          : TREE_TERMINATION_SIGNAL.graceful;
      const terminationFailure = yield* parameters.dependencies.signalTree({
        pid: parameters.childPid,
        signal: firstSignal,
      });
      if (parameters.dependencies.platform === "win32") {
        return { fired: true, terminationFailure };
      }
      yield* Effect.sleep(`${parameters.dependencies.killGraceMs} millis`);
      const forcedFailure = yield* parameters.dependencies.signalTree({
        pid: parameters.childPid,
        signal: TREE_TERMINATION_SIGNAL.forced,
      });
      return { fired: true, terminationFailure: terminationFailure ?? forcedFailure };
    }),
  );

const reportTreeTerminationFailure = (failure: Error): void => {
  process.stderr.write(
    `throttle: could not terminate the whole command tree: ${failure.message}\n`,
  );
};

type Verdict = {
  settled: { kind: "start-failure"; failure: Error } | ChildExit;
  timedOut: boolean;
};

const guardChild = (input: {
  child: CommandChild;
  invocation: Invocation;
  dependencies: RunCommandDependencies;
}): Effect.Effect<Verdict & { terminationFailure: Error | null }> => {
  const canceller = new AbortController();
  return Effect.gen(function* guardRunningChild() {
    const runningHandler = makeRunningInterruptHandler({
      childPid: input.child.pid,
      signalTree: input.dependencies.signalTree,
      reportFailure: reportTreeTerminationFailure,
    });
    installInterruptHandler(runningHandler);
    const fired =
      input.invocation.timeoutSec === 0
        ? Promise.resolve({ fired: false, terminationFailure: null })
        : timeoutFired({
            childPid: input.child.pid,
            timeoutMs: input.invocation.timeoutSec * 1000,
            cancel: canceller.signal,
            dependencies: input.dependencies,
          });
    const settled = yield* input.child.exited;
    canceller.abort();
    const timeout = yield* Effect.promise(() => fired);
    dropInterruptHandler(runningHandler);
    return {
      settled,
      timedOut: timeout.fired,
      terminationFailure: timeout.terminationFailure,
    };
  });
};

const releaseHold = (hold: SlotHold): Promise<undefined> =>
  Effect.runPromise(Effect.promise(() => hold.release()).pipe(Effect.as(undefined)));

const releaseFailureOf = (hold: SlotHold): Promise<unknown> =>
  Effect.runPromise(
    Effect.promise(() => attemptAsync(() => releaseHold(hold))).pipe(
      Effect.map(([releaseFailure]) => releaseFailure),
    ),
  );

const reportChildEnd = (settled: ChildExit): number => {
  if (settled.bySignal !== null) {
    process.stderr.write(`throttle: command was killed by ${settled.bySignal}\n`);
    return 1;
  }
  if (settled.exitCode !== 0) {
    process.stderr.write(`throttle: command failed with exit code ${settled.exitCode}\n`);
    return 1;
  }
  return 0;
};

const reportVerdict = (invocation: Invocation, verdict: Verdict): number => {
  if (verdict.settled.kind === "start-failure") {
    process.stderr.write(
      `throttle: could not start ${invocation.executable}: ${verdict.settled.failure.message}\n`,
    );
    return 1;
  }
  if (verdict.timedOut) {
    process.stderr.write(`throttle: killed: ran past the ${invocation.timeoutSec}s timeout\n`);
    return 1;
  }
  return reportChildEnd(verdict.settled);
};

const reportReleaseFailure = (failure: unknown): number => {
  const detail = failure instanceof Error ? failure.message : String(failure);
  process.stderr.write(`throttle: could not release the slot: ${detail}\n`);
  return 1;
};

const reportRunEnd = (input: {
  invocation: Invocation;
  verdict: Verdict & { terminationFailure: Error | null };
  releaseFailure: unknown;
}): number => {
  if (input.verdict.terminationFailure !== null) {
    reportTreeTerminationFailure(input.verdict.terminationFailure);
  }
  const verdictCode = reportVerdict(input.invocation, input.verdict);
  return input.releaseFailure === null ? verdictCode : reportReleaseFailure(input.releaseFailure);
};

const spawnDetached: RunCommandDependencies["spawnChild"] = (invocation) =>
  spawner
    .spawn(
      ChildProcess.make(invocation.executable, [...invocation.args], {
        detached: true,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      }),
    )
    .pipe(
      Effect.tap((handle) =>
        Effect.addFinalizer(() =>
          Effect.ignore(handle.kill({ forceKillAfter: `${invocation.killGraceMs} millis` })),
        ),
      ),
      Effect.map((handle) => ({
        pid: handle.pid,
        exited: childEndOf(handle).pipe(
          Effect.map((end): ChildExit => ({
            kind: "exit",
            exitCode: end.code,
            bySignal: end.signal,
          })),
        ),
      })),
      Effect.mapError(nativeFailure),
    );

type Started = { kind: "running"; child: CommandChild } | { kind: "start-failure"; failure: Error };

const spawnUnderHeldInterrupt = (input: {
  invocation: Invocation;
  hold: SlotHold;
  dependencies: RunCommandDependencies;
}): Effect.Effect<Started, never, Scope.Scope> =>
  Effect.gen(function* spawnHeld() {
    const held = makeHeldInterrupt({
      release: input.hold.release,
      onUnreleased: warnUnreleased,
    });
    installInterruptHandler(held.handler);
    process.stderr.write(`throttle: run ${input.invocation.commandLine}\n`);
    const started = yield* input.dependencies
      .spawnChild({
        executable: input.invocation.executable,
        args: input.invocation.args,
        killGraceMs: input.dependencies.killGraceMs,
      })
      .pipe(
        Effect.match({
          onFailure: (failure): Started => ({ kind: "start-failure", failure }),
          onSuccess: (child): Started => ({ kind: "running", child }),
        }),
      );
    dropInterruptHandler(held.handler);
    held.standDown();
    yield* Effect.promise(() => held.settled);
    return started;
  });

export const runWithSlot = (input: {
  invocation: Invocation;
  hold: SlotHold;
  dependencies?: Partial<RunCommandDependencies>;
}): Promise<number> =>
  Effect.runPromise(
    Effect.gen(function* runHeldCommand() {
      const dependencies: RunCommandDependencies = {
        platform: input.dependencies?.platform ?? process.platform,
        signalTree: input.dependencies?.signalTree ?? signalProcessTree,
        spawnChild: input.dependencies?.spawnChild ?? spawnDetached,
        killGraceMs: input.dependencies?.killGraceMs ?? KILL_GRACE_MS,
      };
      const verdict = yield* Effect.scoped(
        Effect.gen(function* runInChildScope() {
          const started = yield* spawnUnderHeldInterrupt({
            invocation: input.invocation,
            hold: input.hold,
            dependencies,
          });
          return started.kind === "start-failure"
            ? { settled: started, timedOut: false, terminationFailure: null }
            : yield* guardChild({
                child: started.child,
                invocation: input.invocation,
                dependencies,
              });
        }),
      );
      const releaseFailure = yield* Effect.promise(() => releaseFailureOf(input.hold));
      return reportRunEnd({ invocation: input.invocation, verdict, releaseFailure });
    }),
  );
export type { CommandChild, RunCommandDependencies };
