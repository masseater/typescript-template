import { Effect } from "effect";

import { joinPath, optionalSetting, temporaryDirectory } from "../host.ts";
import { runWithSlot } from "./run-command.ts";
import { ensureSlots, tryAcquireAny, type SlotHold } from "./slots.ts";
import { parseInvocation } from "./usage.ts";
import { waitForSlot, type WaitConfiguration } from "./wait-for-slot.ts";

const DEFAULT_WAIT_BUDGET_MS = 900_000;
const DEFAULT_POLL_MS = 1_000;

export type ThrottleSeams = {
  slotDir?: string;
  limit?: number;
  waitBudgetMs?: number;
  pollMs?: number;
  isInteractive?: boolean;
  killGraceMs?: number;
};

const DEFAULT_LIMIT = 1;

const LIMIT_SETTING = "MST_THROTTLE_LIMIT";

const limitFromEnvironment = (): number | string => {
  const raw = optionalSetting(LIMIT_SETTING);
  if (raw === undefined) {
    return DEFAULT_LIMIT;
  }
  return /^[0-9]+$/.test(raw) && Number(raw) > 0
    ? Number(raw)
    : `throttle: ${LIMIT_SETTING} must be a positive integer, got "${raw}"`;
};

const resolveConfiguration = (seams: ThrottleSeams): WaitConfiguration | string => {
  const limit = seams.limit ?? limitFromEnvironment();
  return typeof limit === "string"
    ? limit
    : {
        slotDir: seams.slotDir ?? joinPath(temporaryDirectory(), "mst-throttle", "mst"),
        limit,
        waitBudgetMs: seams.waitBudgetMs ?? DEFAULT_WAIT_BUDGET_MS,
        pollMs: seams.pollMs ?? DEFAULT_POLL_MS,
        interactive: seams.isInteractive ?? process.stderr.isTTY,
      };
};

const acquireSlot = (configuration: WaitConfiguration): Promise<SlotHold | null> =>
  Effect.runPromise(
    Effect.gen(function* takeSlot() {
      process.stderr.write(`throttle: acquiring a slot (limit ${configuration.limit})\n`);
      yield* ensureSlots(configuration.slotDir, configuration.limit);
      const immediate = yield* Effect.promise(() => tryAcquireAny(configuration));
      if (immediate !== null) {
        return immediate;
      }
      const hold = yield* Effect.promise(() => waitForSlot(configuration));
      return hold === "budget-exhausted" ? null : hold;
    }).pipe(
      Effect.match({
        onFailure: (failure) => {
          process.stderr.write(`throttle: ${String(failure)}\n`);
          return null;
        },
        onSuccess: (hold) => hold,
      }),
    ),
  );

export const runThrottle = (argv: readonly string[], seams: ThrottleSeams = {}): Promise<number> =>
  Effect.runPromise(
    Effect.gen(function* throttleInvocation() {
      const invocation = parseInvocation(argv);
      if (typeof invocation === "string") {
        process.stderr.write(`${invocation}\n`);
        return 2;
      }
      const configuration = resolveConfiguration(seams);
      if (typeof configuration === "string") {
        process.stderr.write(`${configuration}\n`);
        return 2;
      }
      const hold = yield* Effect.promise(() => acquireSlot(configuration));
      return hold === null
        ? 1
        : yield* Effect.promise(() =>
            runWithSlot({
              invocation,
              hold,
              dependencies:
                seams.killGraceMs === undefined ? {} : { killGraceMs: seams.killGraceMs },
            }),
          );
    }),
  );
