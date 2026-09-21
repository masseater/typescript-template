import { tmpdir } from "node:os";

import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  baseName,
  changeMode,
  delay,
  fileExists,
  fileInfo,
  joinPath,
  makeDirectory,
  makeTempDirectory,
  readDirectory,
  readFileString,
  removeDirectory,
  removePath,
  writeFileString,
} from "../host.ts";
import { closeDescriptor, openWritableDescriptor, writeDescriptor } from "../host-descriptors.ts";
import { spawnChild } from "../node-spawn.ts";
import { failedWithCode } from "./failure-codes.ts";
import {
  ensureSlots,
  enqueueWaiter,
  removeWaiter,
  slotStateFingerprint,
  sweepWaiters,
  tryAcquireAny,
} from "./slots.ts";

const EXITED_PID = 999_999_999;

const HOLDER_SOURCE = [
  "const { ensureSlots, tryAcquireAny } = await import(process.argv[1]);",
  "const slotDir = process.argv[2];",
  "ensureSlots(slotDir, 1);",
  "const hold = await tryAcquireAny({ slotDir, limit: 1 });",
  'if (hold === null) throw new Error("expected to acquire the slot");',
  'process.stdout.write("ready");',
  "setInterval(() => void hold, 1000);",
].join(" ");

describe("ensureSlots", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = makeTempDirectory("throttle-slots-");
    onCleanup(() => {
      removePath(temporarySlotDirectory);
    });
    return temporarySlotDirectory;
  });

  describe("a directory ensured twice for three slots", () => {
    const it = slotTest
      .extend("firstSlotMarkerAfterEnsuringTwice", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 3);
        ensureSlots(slotDirectory, 3);
        return fileExists(joinPath(slotDirectory, "slot-0"));
      })
      .extend("secondSlotMarkerAfterEnsuringTwice", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 3);
        ensureSlots(slotDirectory, 3);
        return fileExists(joinPath(slotDirectory, "slot-1"));
      })
      .extend("thirdSlotMarkerAfterEnsuringTwice", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 3);
        ensureSlots(slotDirectory, 3);
        return fileExists(joinPath(slotDirectory, "slot-2"));
      })
      .extend("firstSlotLockAfterEnsuringTwice", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 3);
        ensureSlots(slotDirectory, 3);
        return fileExists(joinPath(slotDirectory, "slot-0.lock"));
      })
      .extend("secondSlotLockAfterEnsuringTwice", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 3);
        ensureSlots(slotDirectory, 3);
        return fileExists(joinPath(slotDirectory, "slot-1.lock"));
      })
      .extend("thirdSlotLockAfterEnsuringTwice", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 3);
        ensureSlots(slotDirectory, 3);
        return fileExists(joinPath(slotDirectory, "slot-2.lock"));
      })
      .extend("firstSlotLockIsAPlainFileAfterEnsuringTwice", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 3);
        ensureSlots(slotDirectory, 3);
        return fileInfo(joinPath(slotDirectory, "slot-0.lock")).isFile();
      })
      .extend("secondSlotLockIsAPlainFileAfterEnsuringTwice", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 3);
        ensureSlots(slotDirectory, 3);
        return fileInfo(joinPath(slotDirectory, "slot-1.lock")).isFile();
      })
      .extend("thirdSlotLockIsAPlainFileAfterEnsuringTwice", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 3);
        ensureSlots(slotDirectory, 3);
        return fileInfo(joinPath(slotDirectory, "slot-2.lock")).isFile();
      })
      .extend("waitersDirectoryAfterEnsuringTwice", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 3);
        ensureSlots(slotDirectory, 3);
        return fileExists(joinPath(slotDirectory, "waiters"));
      });

    it("creates the first slot marker", ({ firstSlotMarkerAfterEnsuringTwice }) => {
      expect(firstSlotMarkerAfterEnsuringTwice).toBe(true);
    });

    it("creates the second slot marker", ({ secondSlotMarkerAfterEnsuringTwice }) => {
      expect(secondSlotMarkerAfterEnsuringTwice).toBe(true);
    });

    it("creates the third slot marker", ({ thirdSlotMarkerAfterEnsuringTwice }) => {
      expect(thirdSlotMarkerAfterEnsuringTwice).toBe(true);
    });

    it("creates the first slot's lock", ({ firstSlotLockAfterEnsuringTwice }) => {
      expect(firstSlotLockAfterEnsuringTwice).toBe(true);
    });

    it("creates the second slot's lock", ({ secondSlotLockAfterEnsuringTwice }) => {
      expect(secondSlotLockAfterEnsuringTwice).toBe(true);
    });

    it("creates the third slot's lock", ({ thirdSlotLockAfterEnsuringTwice }) => {
      expect(thirdSlotLockAfterEnsuringTwice).toBe(true);
    });

    it("leaves the first slot's lock a plain file", ({
      firstSlotLockIsAPlainFileAfterEnsuringTwice,
    }) => {
      expect(firstSlotLockIsAPlainFileAfterEnsuringTwice).toBe(true);
    });

    it("leaves the second slot's lock a plain file", ({
      secondSlotLockIsAPlainFileAfterEnsuringTwice,
    }) => {
      expect(secondSlotLockIsAPlainFileAfterEnsuringTwice).toBe(true);
    });

    it("leaves the third slot's lock a plain file", ({
      thirdSlotLockIsAPlainFileAfterEnsuringTwice,
    }) => {
      expect(thirdSlotLockIsAPlainFileAfterEnsuringTwice).toBe(true);
    });

    it("creates the waiters directory", ({ waitersDirectoryAfterEnsuringTwice }) => {
      expect(waitersDirectoryAfterEnsuringTwice).toBe(true);
    });
  });

  describe("a slot ensured again while a live holder keeps it", () => {
    const it = slotTest.extend("aRivalArrivingAfterEnsuringOverALiveHold", ({ slotDirectory }) =>
      Effect.gen(function* () {
        ensureSlots(slotDirectory, 1);
        const held = yield* Effect.promise(() =>
          tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
        );
        ensureSlots(slotDirectory, 1);
        const rival = yield* Effect.promise(() =>
          tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
        );
        yield* Effect.promise(() => held?.release());
        return rival;
      }),
    );

    it("leaves the live hold standing", ({ aRivalArrivingAfterEnsuringOverALiveHold }) => {
      expect(aRivalArrivingAfterEnsuringOverALiveHold).toBe(null);
    });
  });

  describe("a lock the older protocol left behind as a directory", () => {
    const it = slotTest
      .extend("theRefusalOfALockThatIsADirectory", ({ slotDirectory }) => {
        writeFileString({ location: joinPath(slotDirectory, "slot-0"), written: "" });
        makeDirectory(joinPath(slotDirectory, "slot-0.lock"));
        try {
          ensureSlots(slotDirectory, 1);
        } catch (refusal) {
          return failedWithCode(refusal, new Set(["EACCES", "EISDIR", "EPERM"]));
        }
        throw new Error("ensureSlots wrote through a lock that is a directory");
      })
      .extend("aSlotHeldOnceTheLockDirectoryIsDrained", ({ slotDirectory }) =>
        Effect.gen(function* () {
          writeFileString({ location: joinPath(slotDirectory, "slot-0"), written: "" });
          makeDirectory(joinPath(slotDirectory, "slot-0.lock"));
          removePath(joinPath(slotDirectory, "slot-0.lock"));
          ensureSlots(slotDirectory, 1);
          const held = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
          );
          yield* Effect.promise(() => held?.release());
          return held !== null;
        }),
      );

    it("refuses to initialize over it", ({ theRefusalOfALockThatIsADirectory }) => {
      expect(theRefusalOfALockThatIsADirectory).toBe(true);
    });

    it("initializes once the old holder is drained", ({
      aSlotHeldOnceTheLockDirectoryIsDrained,
    }) => {
      expect(aSlotHeldOnceTheLockDirectoryIsDrained).toBe(true);
    });
  });

  describe("a lock file standing where the older protocol looked for a directory", () => {
    const it = slotTest
      .extend("theRefusalOfCreatingTheLockAsADirectory", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        try {
          makeDirectory(joinPath(slotDirectory, "slot-0.lock"));
        } catch (refusal) {
          return failedWithCode(refusal, new Set(["EEXIST"]));
        }
        throw new Error("a directory was created over the lock file");
      })
      .extend("theRefusalOfReclaimingTheLockAsADirectory", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        try {
          removeDirectory(joinPath(slotDirectory, "slot-0.lock"));
        } catch (refusal) {
          return failedWithCode(refusal, new Set(["ENOTDIR", "EPERM"]));
        }
        throw new Error("the lock file was removed as if it were a directory");
      });

    it("keeps the older protocol from acquiring over it", ({
      theRefusalOfCreatingTheLockAsADirectory,
    }) => {
      expect(theRefusalOfCreatingTheLockAsADirectory).toBe(true);
    });

    it("keeps the older protocol from reclaiming it", ({
      theRefusalOfReclaimingTheLockAsADirectory,
    }) => {
      expect(theRefusalOfReclaimingTheLockAsADirectory).toBe(true);
    });
  });
});

describe("tryAcquireAny", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = makeTempDirectory("throttle-slots-");
    onCleanup(() => {
      removePath(temporarySlotDirectory);
    });
    return temporarySlotDirectory;
  });

  describe("the only slot standing free", () => {
    const it = slotTest.extend("aFirstAcquisitionHoldsASlot", ({ slotDirectory }) =>
      Effect.gen(function* () {
        ensureSlots(slotDirectory, 1);
        const held = yield* Effect.promise(() =>
          tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
        );
        yield* Effect.promise(() => held?.release());
        return held !== null;
      }),
    );

    it("hands back a slot", ({ aFirstAcquisitionHoldsASlot }) => {
      expect(aFirstAcquisitionHoldsASlot).toBe(true);
    });
  });

  describe("a rival arriving while the only slot is held", () => {
    const it = slotTest.extend("aSecondAcquisitionWhileHeld", ({ slotDirectory }) =>
      Effect.gen(function* () {
        ensureSlots(slotDirectory, 1);
        const held = yield* Effect.promise(() =>
          tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
        );
        const rival = yield* Effect.promise(() =>
          tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
        );
        yield* Effect.promise(() => held?.release());
        return rival;
      }),
    );

    it("hands back nothing", ({ aSecondAcquisitionWhileHeld }) => {
      expect(aSecondAcquisitionWhileHeld).toBe(null);
    });
  });

  describe("the only slot after its holder released it", () => {
    const it = slotTest.extend("anAcquisitionAfterRelease", ({ slotDirectory }) =>
      Effect.gen(function* () {
        ensureSlots(slotDirectory, 1);
        const held = yield* Effect.promise(() =>
          tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
        );
        yield* Effect.promise(() => held?.release());
        const holdAfterRelease = yield* Effect.promise(() =>
          tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
        );
        yield* Effect.promise(() => holdAfterRelease?.release());
        return holdAfterRelease !== null;
      }),
    );

    it("hands back the slot again", ({ anAcquisitionAfterRelease }) => {
      expect(anAcquisitionAfterRelease).toBe(true);
    });
  });

  describe("a hold whose release is called more than once", () => {
    const it = slotTest
      .extend("theHoldTakenBeforeReleasingItTwice", ({ slotDirectory }) =>
        Effect.gen(function* () {
          ensureSlots(slotDirectory, 1);
          const held = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
          );
          yield* Effect.promise(() => held?.release());
          yield* Effect.promise(() => held?.release());
          return held !== null;
        }),
      )
      .extend("theConcurrentReleaseIsTheFirstRelease", ({ slotDirectory }) =>
        Effect.gen(function* () {
          ensureSlots(slotDirectory, 1);
          const held = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
          );
          const firstRelease = held?.release();
          const concurrentRelease = held?.release();
          yield* Effect.promise(() => Promise.all([firstRelease, concurrentRelease]));
          return concurrentRelease === firstRelease;
        }),
      )
      .extend("theBytesWrittenToADescriptorOpenedAfterTheRelease", ({ slotDirectory }) =>
        Effect.gen(function* () {
          ensureSlots(slotDirectory, 1);
          const held = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
          );
          yield* Effect.promise(() => held?.release());
          const unrelatedDescriptor = openWritableDescriptor(joinPath(slotDirectory, "unrelated"));
          yield* Effect.promise(() => held?.release());
          const bytesWritten = writeDescriptor(unrelatedDescriptor, "still-open");
          closeDescriptor(unrelatedDescriptor);
          return bytesWritten;
        }),
      );

    it("takes the slot to begin with", ({ theHoldTakenBeforeReleasingItTwice }) => {
      expect(theHoldTakenBeforeReleasingItTwice).toBe(true);
    });

    it("hands every caller the same release", ({ theConcurrentReleaseIsTheFirstRelease }) => {
      expect(theConcurrentReleaseIsTheFirstRelease).toBe(true);
    });

    it("leaves a descriptor opened after it alone", ({
      theBytesWrittenToADescriptorOpenedAfterTheRelease,
    }) => {
      expect(theBytesWrittenToADescriptorOpenedAfterTheRelease).toBe(10);
    });
  });

  describe("a slot marker that cannot take a generation", () => {
    const it = slotTest
      .extend("theRefusalOfAMarkerThatIsADirectory", ({ slotDirectory }) =>
        Effect.gen(function* () {
          ensureSlots(slotDirectory, 1);
          removePath(joinPath(slotDirectory, "slot-0"));
          makeDirectory(joinPath(slotDirectory, "slot-0"));
          try {
            yield* Effect.promise(() => tryAcquireAny({ slotDir: slotDirectory, limit: 1 }));
          } catch (refusal) {
            return failedWithCode(refusal, new Set(["EISDIR", "EPERM"]));
          }
          throw new Error("tryAcquireAny swallowed a marker it could not write");
        }),
      )
      .extend("aSlotHeldAfterAGenerationCouldNotBeRecorded", ({ slotDirectory }) =>
        Effect.gen(function* () {
          ensureSlots(slotDirectory, 1);
          removePath(joinPath(slotDirectory, "slot-0"));
          makeDirectory(joinPath(slotDirectory, "slot-0"));
          yield* Effect.promise(() =>
            Promise.allSettled([tryAcquireAny({ slotDir: slotDirectory, limit: 1 })]),
          );
          removePath(joinPath(slotDirectory, "slot-0"));
          writeFileString({ location: joinPath(slotDirectory, "slot-0"), written: "" });
          const held = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
          );
          yield* Effect.promise(() => held?.release());
          return held !== null;
        }),
      );

    it("lets the refusal escape untouched", ({ theRefusalOfAMarkerThatIsADirectory }) => {
      expect(theRefusalOfAMarkerThatIsADirectory).toBe(true);
    });

    it("gives the lock back on the way out", ({ aSlotHeldAfterAGenerationCouldNotBeRecorded }) => {
      expect(aSlotHeldAfterAGenerationCouldNotBeRecorded).toBe(true);
    });
  });
});

describe("slotStateFingerprint", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = makeTempDirectory("throttle-slots-");
    onCleanup(() => {
      removePath(temporarySlotDirectory);
    });
    return temporarySlotDirectory;
  });

  describe("two slots standing free", () => {
    const it = test.extend("theFingerprintOfFreeSlots", ({}, { onCleanup }) => {
      const temporarySlotDirectory = makeTempDirectory("throttle-slots-");
      onCleanup(() => {
        removePath(temporarySlotDirectory);
      });
      ensureSlots(temporarySlotDirectory, 2);
      return slotStateFingerprint(temporarySlotDirectory, 2);
    });

    it("names every slot no one has taken yet as unused", ({ theFingerprintOfFreeSlots }) => {
      expect(theFingerprintOfFreeSlots).toBe("unused,unused");
    });
  });

  describe("one slot out of two taken", () => {
    const it = slotTest.extend("theFingerprintChangesOnceASlotIsHeld", ({ slotDirectory }) =>
      Effect.gen(function* () {
        ensureSlots(slotDirectory, 2);
        const free = slotStateFingerprint(slotDirectory, 2);
        const held = yield* Effect.promise(() =>
          tryAcquireAny({ slotDir: slotDirectory, limit: 2 }),
        );
        const taken = slotStateFingerprint(slotDirectory, 2);
        yield* Effect.promise(() => held?.release());
        return taken !== free;
      }),
    );

    it("changes once a slot is held", ({ theFingerprintChangesOnceASlotIsHeld }) => {
      expect(theFingerprintChangesOnceASlotIsHeld).toBe(true);
    });
  });

  describe("a slot its holder has let go", () => {
    const it = slotTest.extend("theFingerprintStandsAfterTheHolderLetGo", ({ slotDirectory }) =>
      Effect.gen(function* () {
        ensureSlots(slotDirectory, 2);
        const held = yield* Effect.promise(() =>
          tryAcquireAny({ slotDir: slotDirectory, limit: 2 }),
        );
        const whileHeld = slotStateFingerprint(slotDirectory, 2);
        yield* Effect.promise(() => held?.release());
        return slotStateFingerprint(slotDirectory, 2) === whileHeld;
      }),
    );

    it("reads as it did while the slot was held", ({ theFingerprintStandsAfterTheHolderLetGo }) => {
      expect(theFingerprintStandsAfterTheHolderLetGo).toBe(true);
    });
  });

  describe("a slot taken, released and taken again", () => {
    const it = slotTest
      .extend("theFingerprintChangesWhenTheSlotIsTakenAnew", ({ slotDirectory }) =>
        Effect.gen(function* () {
          ensureSlots(slotDirectory, 2);
          const first = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 2 }),
          );
          const whileFirstHeld = slotStateFingerprint(slotDirectory, 2);
          yield* Effect.promise(() => first?.release());
          const second = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 2 }),
          );
          const whileSecondHeld = slotStateFingerprint(slotDirectory, 2);
          yield* Effect.promise(() => second?.release());
          return whileSecondHeld !== whileFirstHeld;
        }),
      )
      .extend("theGenerationOfTheFirstSlotIsWrittenAnew", ({ slotDirectory }) =>
        Effect.gen(function* () {
          ensureSlots(slotDirectory, 2);
          const first = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 2 }),
          );
          const firstGeneration = readFileString(joinPath(slotDirectory, "slot-0"), "utf8");
          yield* Effect.promise(() => first?.release());
          const second = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 2 }),
          );
          const secondGeneration = readFileString(joinPath(slotDirectory, "slot-0"), "utf8");
          yield* Effect.promise(() => second?.release());
          return secondGeneration !== firstGeneration;
        }),
      );

    it("changes on the second acquisition", ({ theFingerprintChangesWhenTheSlotIsTakenAnew }) => {
      expect(theFingerprintChangesWhenTheSlotIsTakenAnew).toBe(true);
    });

    it("writes the slot a generation of its own", ({
      theGenerationOfTheFirstSlotIsWrittenAnew,
    }) => {
      expect(theGenerationOfTheFirstSlotIsWrittenAnew).toBe(true);
    });
  });

  describe("a slot marker that is not on disk", () => {
    const it = test.extend("theFingerprintOfAMissingMarker", ({}, { onCleanup }) => {
      const temporarySlotDirectory = makeTempDirectory("throttle-slots-");
      onCleanup(() => {
        removePath(temporarySlotDirectory);
      });
      ensureSlots(temporarySlotDirectory, 1);
      removePath(joinPath(temporarySlotDirectory, "slot-0"));
      return slotStateFingerprint(temporarySlotDirectory, 1);
    });

    it("names the generation it could not read", ({ theFingerprintOfAMissingMarker }) => {
      expect(theFingerprintOfAMissingMarker).toBe("unreadable:ENOENT");
    });
  });
});

describe("a slot whose holder is killed without releasing it", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = makeTempDirectory("throttle-slots-");
    onCleanup(() => {
      removePath(temporarySlotDirectory);
    });
    return temporarySlotDirectory;
  });

  describe("another process holding the only slot", () => {
    const it = slotTest
      .extend("theFirstWordOfTheHolder", ({ slotDirectory }, { onCleanup }) =>
        Effect.gen(function* () {
          const holder = spawnChild({
            executable: process.execPath,
            handed: [
              "-e",
              HOLDER_SOURCE,
              new URL("./slots.ts", import.meta.url).href,
              slotDirectory,
            ],
            spawnOptions: { stdio: ["ignore", "pipe", "inherit"] },
          });
          onCleanup(() => {
            if (holder.exitCode === null && holder.signalCode === null) holder.kill("SIGKILL");
          });
          const firstEmission = yield* Effect.promise(
            () =>
              new Promise<Buffer>((resolve) => {
                holder.stdout.once("data", (emission: Buffer) => {
                  resolve(emission);
                });
              }),
          );
          return String(firstEmission);
        }),
      )
      .extend("aRivalWhileTheHolderLives", ({ slotDirectory }, { onCleanup }) =>
        Effect.gen(function* () {
          const holder = spawnChild({
            executable: process.execPath,
            handed: [
              "-e",
              HOLDER_SOURCE,
              new URL("./slots.ts", import.meta.url).href,
              slotDirectory,
            ],
            spawnOptions: { stdio: ["ignore", "pipe", "inherit"] },
          });
          onCleanup(() => {
            if (holder.exitCode === null && holder.signalCode === null) holder.kill("SIGKILL");
          });
          yield* Effect.promise(
            () =>
              new Promise<void>((resolve) => {
                holder.stdout.once("data", () => {
                  resolve();
                });
              }),
          );
          return tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        }),
      )
      .extend("aReplacementOnceTheHolderIsKilled", ({ slotDirectory }, { onCleanup }) =>
        Effect.gen(function* () {
          const holder = spawnChild({
            executable: process.execPath,
            handed: [
              "-e",
              HOLDER_SOURCE,
              new URL("./slots.ts", import.meta.url).href,
              slotDirectory,
            ],
            spawnOptions: { stdio: ["ignore", "pipe", "inherit"] },
          });
          onCleanup(() => {
            if (holder.exitCode === null && holder.signalCode === null) holder.kill("SIGKILL");
          });
          yield* Effect.promise(
            () =>
              new Promise<void>((resolve) => {
                holder.stdout.once("data", () => {
                  resolve();
                });
              }),
          );
          const exited = new Promise<void>((resolve) => {
            holder.once("exit", () => {
              resolve();
            });
          });
          holder.kill("SIGKILL");
          yield* Effect.promise(() => exited);
          const replacement = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
          );
          yield* Effect.promise(() => replacement?.release());
          return replacement !== null;
        }),
      );

    it("says it took the slot", { timeout: 30_000 }, ({ theFirstWordOfTheHolder }) => {
      expect(theFirstWordOfTheHolder).toBe("ready");
    });

    it(
      "keeps every rival out while it lives",
      { timeout: 30_000 },
      ({ aRivalWhileTheHolderLives }) => {
        expect(aRivalWhileTheHolderLives).toBe(null);
      },
    );

    it(
      "frees the slot once it is killed",
      { timeout: 30_000 },
      ({ aReplacementOnceTheHolderIsKilled }) => {
        expect(aReplacementOnceTheHolderIsKilled).toBe(true);
      },
    );
  });
});

describe("sweepWaiters", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = makeTempDirectory("throttle-slots-");
    onCleanup(() => {
      removePath(temporarySlotDirectory);
    });
    return temporarySlotDirectory;
  });

  describe("a queue holding this process's entry beside four planted ones", () => {
    const it = slotTest
      .extend("theSurvivorsBesideTheOwnWaiterEntry", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const waiters = joinPath(slotDirectory, "waiters");
        enqueueWaiter(slotDirectory);
        writeFileString({
          location: joinPath(waiters, "0000000000001-broken-aaaaaaaa"),
          written: "not a pid\n",
        });
        makeDirectory(joinPath(waiters, "0000000000002-unreadable-bbbbbbbb"));
        writeFileString({
          location: joinPath(waiters, "0000000000003-dead-cccccccc"),
          written: `${String(EXITED_PID)}\n`,
        });
        writeFileString({
          location: joinPath(waiters, "0000000000004-root-dddddddd"),
          written: "1\n",
        });
        return sweepWaiters(slotDirectory).slice(0, 1);
      })
      .extend("theOwnWaiterEntryIsTheLastSurvivor", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const waiters = joinPath(slotDirectory, "waiters");
        const ownEntry = enqueueWaiter(slotDirectory);
        writeFileString({
          location: joinPath(waiters, "0000000000001-broken-aaaaaaaa"),
          written: "not a pid\n",
        });
        makeDirectory(joinPath(waiters, "0000000000002-unreadable-bbbbbbbb"));
        writeFileString({
          location: joinPath(waiters, "0000000000003-dead-cccccccc"),
          written: `${String(EXITED_PID)}\n`,
        });
        writeFileString({
          location: joinPath(waiters, "0000000000004-root-dddddddd"),
          written: "1\n",
        });
        return sweepWaiters(slotDirectory).at(-1) === baseName(ownEntry);
      })
      .extend("theWaitersLeftOnDiskThatSweepingDidNotKeep", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const waiters = joinPath(slotDirectory, "waiters");
        enqueueWaiter(slotDirectory);
        writeFileString({
          location: joinPath(waiters, "0000000000001-broken-aaaaaaaa"),
          written: "not a pid\n",
        });
        makeDirectory(joinPath(waiters, "0000000000002-unreadable-bbbbbbbb"));
        writeFileString({
          location: joinPath(waiters, "0000000000003-dead-cccccccc"),
          written: `${String(EXITED_PID)}\n`,
        });
        writeFileString({
          location: joinPath(waiters, "0000000000004-root-dddddddd"),
          written: "1\n",
        });
        const survivors = sweepWaiters(slotDirectory);
        return readDirectory(waiters).filter(
          (waiterFilename) => !survivors.includes(waiterFilename),
        );
      })
      .extend("theSurvivorsSweepingKeptThatAreGoneFromDisk", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const waiters = joinPath(slotDirectory, "waiters");
        enqueueWaiter(slotDirectory);
        writeFileString({
          location: joinPath(waiters, "0000000000001-broken-aaaaaaaa"),
          written: "not a pid\n",
        });
        makeDirectory(joinPath(waiters, "0000000000002-unreadable-bbbbbbbb"));
        writeFileString({
          location: joinPath(waiters, "0000000000003-dead-cccccccc"),
          written: `${String(EXITED_PID)}\n`,
        });
        writeFileString({
          location: joinPath(waiters, "0000000000004-root-dddddddd"),
          written: "1\n",
        });
        const survivors = sweepWaiters(slotDirectory);
        return survivors.filter(
          (survivingWaiterFilename) => !readDirectory(waiters).includes(survivingWaiterFilename),
        );
      });

    it("keeps the live entries in name order", ({ theSurvivorsBesideTheOwnWaiterEntry }) => {
      expect(theSurvivorsBesideTheOwnWaiterEntry).toStrictEqual(["0000000000004-root-dddddddd"]);
    });

    it("keeps the entry this process enqueued", ({ theOwnWaiterEntryIsTheLastSurvivor }) => {
      expect(theOwnWaiterEntryIsTheLastSurvivor).toBe(true);
    });

    it("deletes every entry it did not keep", ({ theWaitersLeftOnDiskThatSweepingDidNotKeep }) => {
      expect(theWaitersLeftOnDiskThatSweepingDidNotKeep).toStrictEqual([]);
    });

    it("leaves every entry it kept on disk", ({ theSurvivorsSweepingKeptThatAreGoneFromDisk }) => {
      expect(theSurvivorsSweepingKeptThatAreGoneFromDisk).toStrictEqual([]);
    });
  });
});

describe("removeWaiter", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = makeTempDirectory("throttle-slots-");
    onCleanup(() => {
      removePath(temporarySlotDirectory);
    });
    return temporarySlotDirectory;
  });

  describe("an entry removed twice", () => {
    const it = slotTest.extend("theWaitersLeftAfterRemovingTwice", ({ slotDirectory }) => {
      ensureSlots(slotDirectory, 1);
      const waiterEntry = enqueueWaiter(slotDirectory);
      removeWaiter(waiterEntry);
      removeWaiter(waiterEntry);
      return readDirectory(joinPath(slotDirectory, "waiters"));
    });

    it("tolerates an entry that is already gone", ({ theWaitersLeftAfterRemovingTwice }) => {
      expect(theWaitersLeftAfterRemovingTwice).toStrictEqual([]);
    });
  });
});

describe("enqueueWaiter", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = makeTempDirectory("throttle-slots-");
    onCleanup(() => {
      removePath(temporarySlotDirectory);
    });
    return temporarySlotDirectory;
  });

  describe("two entries enqueued in turn", () => {
    const it = slotTest.extend("theSurvivorsOfTwoWaitersEnqueuedInTurn", ({ slotDirectory }) =>
      Effect.gen(function* () {
        ensureSlots(slotDirectory, 1);
        const first = enqueueWaiter(slotDirectory);
        yield* Effect.promise(() => delay(5));
        const second = enqueueWaiter(slotDirectory);
        return (
          sweepWaiters(slotDirectory).join("\n") ===
          [first, second].map((enqueuedWaiter) => baseName(enqueuedWaiter)).join("\n")
        );
      }),
    );

    it("names them so they sort by creation order", ({
      theSurvivorsOfTwoWaitersEnqueuedInTurn,
    }) => {
      expect(theSurvivorsOfTwoWaitersEnqueuedInTurn).toBe(true);
    });
  });
});

describe("a slot directory this process may not read", () => {
  describe("a fingerprint read off a directory closed to this process", () => {
    const it = test.extend("theFingerprintOfAClosedSlotDirectory", ({}, { onCleanup }) => {
      const temporarySlotDirectory = makeTempDirectory("throttle-slots-");
      onCleanup(() => {
        changeMode(temporarySlotDirectory, 0o700);
        removePath(temporarySlotDirectory);
      });
      ensureSlots(temporarySlotDirectory, 1);
      changeMode(temporarySlotDirectory, 0o000);
      return slotStateFingerprint(temporarySlotDirectory, 1);
    });

    it("names the refusal rather than reading it as an unused slot", ({
      theFingerprintOfAClosedSlotDirectory,
    }) => {
      expect(theFingerprintOfAClosedSlotDirectory).toBe("unreadable:EACCES");
    });
  });

  describe("a sweep over an entry closed to this process", () => {
    const it = test.extend("theRefusalOfAClosedWaiterEntry", ({}, { onCleanup }) => {
      const temporarySlotDirectory = makeTempDirectory("throttle-slots-");
      onCleanup(() => {
        changeMode(temporarySlotDirectory, 0o700);
        removePath(temporarySlotDirectory);
      });
      ensureSlots(temporarySlotDirectory, 1);
      changeMode(enqueueWaiter(temporarySlotDirectory), 0o000);
      try {
        return sweepWaiters(temporarySlotDirectory);
      } catch (refused) {
        return refused instanceof Error ? refused.message.split(",")[0] : String(refused);
      }
    });

    it("hands the refusal on rather than reading it as an entry with no owner", ({
      theRefusalOfAClosedWaiterEntry,
    }) => {
      expect(theRefusalOfAClosedWaiterEntry).toBe("EACCES: permission denied");
    });
  });
});
