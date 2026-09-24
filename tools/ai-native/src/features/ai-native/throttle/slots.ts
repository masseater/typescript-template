import { Effect } from "effect";

import {
  epochMillis,
  joinPath,
  makeDirectory,
  randomHex,
  readDirectory,
  readFileString,
  removePath,
  writeFileString,
} from "../host.ts";
import { tryAcquireFileLock } from "./acquire-file-lock.ts";
import { failedWithCode, failureSpelling } from "./failure-codes.ts";

const markerPath = (slotDir: string, index: number): string => joinPath(slotDir, `slot-${index}`);

const lockPath = (marker: string): string => `${marker}.lock`;

const waitersDir = (slotDir: string): string => joinPath(slotDir, "waiters");

const slotIndexes = (limit: number): number[] => [...Array(limit).keys()];

export const ensureSlots = (slotDir: string, limit: number): Effect.Effect<void, Error> =>
  makeDirectory(waitersDir(slotDir)).pipe(
    Effect.andThen(
      Effect.forEach(
        slotIndexes(limit),
        (index) => {
          const marker = markerPath(slotDir, index);
          return writeFileString({ location: marker, written: "", append: true }).pipe(
            Effect.andThen(
              writeFileString({ location: lockPath(marker), written: "", append: true }),
            ),
          );
        },
        { discard: true },
      ),
    ),
  );

export type SlotHold = { release: () => Promise<void> };

const lockUnlessHeld = (marker: string): Effect.Effect<SlotHold | null, Error> =>
  tryAcquireFileLock({ lockPath: lockPath(marker), markerPath: marker });

export type AcquireConfiguration = {
  slotDir: string;
  limit: number;
};

const firstFreeSlot = (
  configuration: AcquireConfiguration,
): Effect.Effect<SlotHold | null, Error> =>
  Effect.gen(function* lockFirstFreeSlot() {
    for (const index of slotIndexes(configuration.limit)) {
      const acquired = yield* lockUnlessHeld(markerPath(configuration.slotDir, index));
      if (acquired !== null) return acquired;
    }
    return null;
  });

export const tryAcquireAny = (configuration: AcquireConfiguration): Promise<SlotHold | null> =>
  Effect.runPromise(firstFreeSlot(configuration));

const generationIdentity = (marker: string): Effect.Effect<string> =>
  readFileString(marker).pipe(
    Effect.match({
      onFailure: (unreadableGeneration) => `unreadable:${failureSpelling(unreadableGeneration)}`,
      onSuccess: (generation) => generation || "unused",
    }),
  );

export const slotStateFingerprint = (slotDir: string, limit: number): Effect.Effect<string> =>
  Effect.forEach(slotIndexes(limit), (index) =>
    generationIdentity(markerPath(slotDir, index)),
  ).pipe(Effect.map((generations) => generations.join(",")));

export const reserveWaiterPath = (slotDir: string): string => {
  const spelled = [String(epochMillis()).padStart(13, "0"), String(process.pid), randomHex(4)].join(
    "-",
  );
  return joinPath(waitersDir(slotDir), spelled);
};

export const writeWaiterEntry = (waiterPath: string): Effect.Effect<void, Error> =>
  writeFileString({ location: waiterPath, written: `${process.pid}\n` });

export const removeWaiter = (waiterPath: string): Effect.Effect<void, Error> =>
  removePath(waiterPath);

const OWNED_BY_ANOTHER_USER_CODES: ReadonlySet<string> = new Set(["EPERM"]);

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (failure) {
    return failedWithCode(failure, OWNED_BY_ANOTHER_USER_CODES);
  }
};

const UNREADABLE_ENTRY_CODES: ReadonlySet<string> = new Set(["ENOENT", "ENOTDIR", "EISDIR"]);

const recordedPid = (waiterPath: string): Effect.Effect<number | null, Error> =>
  readFileString(waiterPath).pipe(
    Effect.map((written) => (/^[0-9]+$/.test(written.trim()) ? Number(written.trim()) : null)),
    Effect.catchIf(
      (unreadableWaiter) => failedWithCode(unreadableWaiter, UNREADABLE_ENTRY_CODES),
      () => Effect.succeed(null),
    ),
  );

const survives = (waiterPath: string): Effect.Effect<boolean, Error> =>
  recordedPid(waiterPath).pipe(
    Effect.flatMap((pid) =>
      pid !== null && isAlive(pid)
        ? Effect.succeed(true)
        : removeWaiter(waiterPath).pipe(Effect.as(false)),
    ),
  );

export const sweepWaiters = (slotDir: string): Effect.Effect<string[], Error> =>
  readDirectory(waitersDir(slotDir)).pipe(
    Effect.flatMap((spelledEntries) =>
      Effect.filter([...spelledEntries].toSorted(), (spelled) =>
        survives(joinPath(waitersDir(slotDir), spelled)),
      ),
    ),
  );
