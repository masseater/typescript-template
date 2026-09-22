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

export const ensureSlots = (slotDir: string, limit: number): void => {
  makeDirectory(waitersDir(slotDir));
  for (const index of slotIndexes(limit)) {
    const marker = markerPath(slotDir, index);
    writeFileString({ location: marker, written: "", append: true });
    writeFileString({ location: lockPath(marker), written: "", append: true });
  }
};

export type SlotHold = { release: () => Promise<void> };

const lockUnlessHeld = (marker: string): SlotHold | null =>
  tryAcquireFileLock({ lockPath: lockPath(marker), markerPath: marker });

export type AcquireConfiguration = {
  slotDir: string;
  limit: number;
};

const firstFreeSlot = (configuration: AcquireConfiguration): SlotHold | null => {
  for (const index of slotIndexes(configuration.limit)) {
    const acquired = lockUnlessHeld(markerPath(configuration.slotDir, index));
    if (acquired !== null) return acquired;
  }
  return null;
};

export const tryAcquireAny = (configuration: AcquireConfiguration): Promise<SlotHold | null> =>
  Effect.runPromise(Effect.try(() => firstFreeSlot(configuration)));

const generationIdentity = (marker: string): string => {
  try {
    return readFileString(marker) || "unused";
  } catch (unreadableGeneration) {
    return `unreadable:${failureSpelling(unreadableGeneration)}`;
  }
};

export const slotStateFingerprint = (slotDir: string, limit: number): string =>
  slotIndexes(limit)
    .map((index) => generationIdentity(markerPath(slotDir, index)))
    .join(",");

export const reserveWaiterPath = (slotDir: string): string => {
  const spelled = [String(epochMillis()).padStart(13, "0"), String(process.pid), randomHex(4)].join(
    "-",
  );
  return joinPath(waitersDir(slotDir), spelled);
};

export const writeWaiterEntry = (waiterPath: string): void => {
  writeFileString({ location: waiterPath, written: `${process.pid}\n` });
};

export const enqueueWaiter = (slotDir: string): string => {
  const waiterPath = reserveWaiterPath(slotDir);
  writeWaiterEntry(waiterPath);
  return waiterPath;
};

export const removeWaiter = (waiterPath: string): void => {
  removePath(waiterPath);
};

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

const recordedPid = (waiterPath: string): number | null => {
  try {
    const written = readFileString(waiterPath).trim();
    return /^[0-9]+$/.test(written) ? Number(written) : null;
  } catch (unreadableWaiter) {
    if (failedWithCode(unreadableWaiter, UNREADABLE_ENTRY_CODES)) return null;
    throw unreadableWaiter;
  }
};

const survives = (waiterPath: string): boolean => {
  const pid = recordedPid(waiterPath);
  if (pid !== null && isAlive(pid)) return true;
  removeWaiter(waiterPath);
  return false;
};

export const sweepWaiters = (slotDir: string): string[] =>
  [...readDirectory(waitersDir(slotDir))]
    .toSorted()
    .filter((spelled) => survives(joinPath(waitersDir(slotDir), spelled)));
