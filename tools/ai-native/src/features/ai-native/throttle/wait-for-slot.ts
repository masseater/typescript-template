import { Effect } from "effect";

import { baseName, epochMillis } from "../host.ts";
import {
  dropInterruptHandler,
  installInterruptHandler,
  makeWaitingInterruptHandler,
} from "./signals.ts";
import {
  removeWaiter,
  reserveWaiterPath,
  slotStateFingerprint,
  sweepWaiters,
  tryAcquireAny,
  writeWaiterEntry,
  type AcquireConfiguration,
  type SlotHold,
} from "./slots.ts";

export type WaitConfiguration = AcquireConfiguration & {
  waitBudgetMs: number;
  pollMs: number;
  interactive: boolean;
};

type PollState = {
  entryName: string;
  startedAt: number;
  lastPrinted: string;
};

const reportProgress = (configuration: WaitConfiguration, held: PollState): string => {
  const waiting = sweepWaiters(configuration.slotDir);
  const line = `throttle: waiting ${waiting.indexOf(held.entryName) + 1}/${waiting.length}`;
  if (configuration.interactive) {
    const elapsedSec = Math.floor((epochMillis() - held.startedAt) / 1000);
    process.stderr.write(`\r\u001B[K${line} ${elapsedSec}s`);
    return held.lastPrinted;
  }
  const printKey = `${line}|${slotStateFingerprint(configuration.slotDir, configuration.limit)}`;
  if (printKey !== held.lastPrinted) process.stderr.write(`${line}\n`);
  return printKey;
};

const closeProgressLine = (configuration: WaitConfiguration): void => {
  if (configuration.interactive) process.stderr.write("\n");
};

const budgetExhausted = (configuration: WaitConfiguration): "budget-exhausted" => {
  closeProgressLine(configuration);
  process.stderr.write(
    `throttle: gave up: every slot stayed held for the whole ${configuration.waitBudgetMs}ms wait budget\n`,
  );
  return "budget-exhausted";
};

const pollForSlot = (
  configuration: WaitConfiguration,
  held: PollState,
): Promise<SlotHold | "budget-exhausted"> =>
  Effect.runPromise(
    Effect.gen(function* pollHeldSlot() {
      const lastPrinted = reportProgress(configuration, held);
      const hold = yield* Effect.promise(() => tryAcquireAny(configuration));
      if (hold !== null) {
        closeProgressLine(configuration);
        return hold;
      }
      if (epochMillis() - held.startedAt >= configuration.waitBudgetMs) {
        return budgetExhausted(configuration);
      }
      yield* Effect.sleep(`${configuration.pollMs} millis`);
      return yield* Effect.promise(() => pollForSlot(configuration, { ...held, lastPrinted }));
    }),
  );

export const waitForSlot = (
  configuration: WaitConfiguration,
): Promise<SlotHold | "budget-exhausted"> =>
  Effect.runPromise(
    Effect.gen(function* waitUntilFree() {
      const waiterPath = reserveWaiterPath(configuration.slotDir);
      const interruptHandler = makeWaitingInterruptHandler({
        entryPath: waiterPath,
        removeEntry: removeWaiter,
      });
      installInterruptHandler(interruptHandler);
      writeWaiterEntry(waiterPath);
      return yield* Effect.promise(() =>
        pollForSlot(configuration, {
          entryName: baseName(waiterPath),
          startedAt: epochMillis(),
          lastPrinted: "",
        }),
      ).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            removeWaiter(waiterPath);
            dropInterruptHandler(interruptHandler);
          }),
        ),
      );
    }),
  );
