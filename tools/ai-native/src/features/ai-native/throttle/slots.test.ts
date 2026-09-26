import { Effect, Exit, Option, Scope, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { describe, expect, test } from "vite-plus/test";

import { childEndOf, runCaptured } from "../child-process.ts";
import {
  fileExists,
  filesystem,
  makeDirectory,
  paths,
  readDirectory,
  readFileString,
  removePath,
  spawner,
  writeFileString,
} from "../host.ts";
import { failedWithCode } from "./failure-codes.ts";
import {
  ensureSlots,
  removeWaiter,
  reserveWaiterPath,
  slotStateFingerprint,
  sweepWaiters,
  tryAcquireAny,
  writeWaiterEntry,
} from "./slots.ts";

const EXITED_PID = 999_999_999;

const HOLDER_SOURCE = [
  "const { Effect } = await import(process.argv[1]);",
  "const { ensureSlots, tryAcquireAny } = await import(process.argv[2]);",
  "const slotDir = process.argv[3];",
  "await Effect.runPromise(ensureSlots(slotDir, 1));",
  "const hold = await tryAcquireAny({ slotDir, limit: 1 });",
  'if (hold === null) throw new Error("expected to acquire the slot");',
  'process.stdout.write("ready");',
  "setInterval(() => void hold, 1000);",
].join(" ");

const OLDER_PROTOCOL_RECLAIM = [
  "try {",
  'require("node:fs").rmdirSync(process.argv[1]);',
  'process.stdout.write("reclaimed");',
  "} catch (refusal) {",
  "process.stdout.write(String(refusal.code));",
  "}",
].join(" ");

describe("ensureSlots", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = Effect.runPromise(
      filesystem.makeTempDirectory({ prefix: "throttle-slots-" }),
    );
    onCleanup(() =>
      Effect.runPromise(
        Effect.promise(() => temporarySlotDirectory).pipe(Effect.flatMap(removePath)),
      ),
    );
    return temporarySlotDirectory;
  });

  describe("a directory ensured twice for three slots", () => {
    const it = slotTest
      .extend("firstSlotMarkerAfterEnsuringTwice", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 3);
            yield* ensureSlots(slotDirectory, 3);
            return yield* fileExists(paths.join(slotDirectory, "slot-0"));
          }),
        ),
      )
      .extend("secondSlotMarkerAfterEnsuringTwice", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 3);
            yield* ensureSlots(slotDirectory, 3);
            return yield* fileExists(paths.join(slotDirectory, "slot-1"));
          }),
        ),
      )
      .extend("thirdSlotMarkerAfterEnsuringTwice", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 3);
            yield* ensureSlots(slotDirectory, 3);
            return yield* fileExists(paths.join(slotDirectory, "slot-2"));
          }),
        ),
      )
      .extend("firstSlotLockAfterEnsuringTwice", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 3);
            yield* ensureSlots(slotDirectory, 3);
            return yield* fileExists(paths.join(slotDirectory, "slot-0.lock"));
          }),
        ),
      )
      .extend("secondSlotLockAfterEnsuringTwice", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 3);
            yield* ensureSlots(slotDirectory, 3);
            return yield* fileExists(paths.join(slotDirectory, "slot-1.lock"));
          }),
        ),
      )
      .extend("thirdSlotLockAfterEnsuringTwice", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 3);
            yield* ensureSlots(slotDirectory, 3);
            return yield* fileExists(paths.join(slotDirectory, "slot-2.lock"));
          }),
        ),
      )
      .extend("firstSlotLockIsAPlainFileAfterEnsuringTwice", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 3);
            yield* ensureSlots(slotDirectory, 3);
            return (
              (yield* filesystem.stat(paths.join(slotDirectory, "slot-0.lock"))).type === "File"
            );
          }),
        ),
      )
      .extend("secondSlotLockIsAPlainFileAfterEnsuringTwice", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 3);
            yield* ensureSlots(slotDirectory, 3);
            return (
              (yield* filesystem.stat(paths.join(slotDirectory, "slot-1.lock"))).type === "File"
            );
          }),
        ),
      )
      .extend("thirdSlotLockIsAPlainFileAfterEnsuringTwice", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 3);
            yield* ensureSlots(slotDirectory, 3);
            return (
              (yield* filesystem.stat(paths.join(slotDirectory, "slot-2.lock"))).type === "File"
            );
          }),
        ),
      )
      .extend("waitersDirectoryAfterEnsuringTwice", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 3);
            yield* ensureSlots(slotDirectory, 3);
            return yield* fileExists(paths.join(slotDirectory, "waiters"));
          }),
        ),
      );

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
      Effect.runPromise(
        Effect.gen(function* () {
          yield* ensureSlots(slotDirectory, 1);
          const held = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
          );
          yield* ensureSlots(slotDirectory, 1);
          const rival = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
          );
          if (held) yield* Effect.promise(() => held.release());
          return rival;
        }),
      ),
    );

    it("leaves the live hold standing", ({ aRivalArrivingAfterEnsuringOverALiveHold }) => {
      expect(aRivalArrivingAfterEnsuringOverALiveHold).toBe(null);
    });
  });

  describe("a lock the older protocol left behind as a directory", () => {
    const it = slotTest
      .extend("theRefusalOfALockThatIsADirectory", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* writeFileString({ location: paths.join(slotDirectory, "slot-0"), written: "" });
            yield* makeDirectory(paths.join(slotDirectory, "slot-0.lock"));
            return yield* ensureSlots(slotDirectory, 1).pipe(
              Effect.matchEffect({
                onFailure: (refusal) =>
                  Effect.succeed(failedWithCode(refusal, new Set(["EACCES", "EISDIR", "EPERM"]))),
                onSuccess: () => Effect.die("ensureSlots wrote through a lock that is a directory"),
              }),
            );
          }),
        ),
      )
      .extend("aSlotHeldOnceTheLockDirectoryIsDrained", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* writeFileString({ location: paths.join(slotDirectory, "slot-0"), written: "" });
            yield* makeDirectory(paths.join(slotDirectory, "slot-0.lock"));
            yield* removePath(paths.join(slotDirectory, "slot-0.lock"));
            yield* ensureSlots(slotDirectory, 1);
            const held = yield* Effect.promise(() =>
              tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
            );
            if (held) yield* Effect.promise(() => held.release());
            return held !== null;
          }),
        ),
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
      .extend("theRefusalOfCreatingTheLockAsADirectory", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 1);
            return yield* makeDirectory(paths.join(slotDirectory, "slot-0.lock")).pipe(
              Effect.matchEffect({
                onFailure: (refusal) =>
                  Effect.succeed(failedWithCode(refusal, new Set(["EEXIST"]))),
                onSuccess: () => Effect.die("a directory was created over the lock file"),
              }),
            );
          }),
        ),
      )
      .extend("theRefusalOfReclaimingTheLockAsADirectory", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 1);
            const reclaim = yield* runCaptured({
              executable: process.execPath,
              handed: ["-e", OLDER_PROTOCOL_RECLAIM, paths.join(slotDirectory, "slot-0.lock")],
            });
            return ["ENOTDIR", "EPERM"].includes(reclaim.stdout);
          }),
        ),
      );

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
    const temporarySlotDirectory = Effect.runPromise(
      filesystem.makeTempDirectory({ prefix: "throttle-slots-" }),
    );
    onCleanup(() =>
      Effect.runPromise(
        Effect.promise(() => temporarySlotDirectory).pipe(Effect.flatMap(removePath)),
      ),
    );
    return temporarySlotDirectory;
  });

  describe("the only slot standing free", () => {
    const it = slotTest.extend("aFirstAcquisitionHoldsASlot", ({ slotDirectory }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* ensureSlots(slotDirectory, 1);
          const held = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
          );
          if (held) yield* Effect.promise(() => held.release());
          return held !== null;
        }),
      ),
    );

    it("hands back a slot", ({ aFirstAcquisitionHoldsASlot }) => {
      expect(aFirstAcquisitionHoldsASlot).toBe(true);
    });
  });

  describe("a rival arriving while the only slot is held", () => {
    const it = slotTest.extend("aSecondAcquisitionWhileHeld", ({ slotDirectory }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* ensureSlots(slotDirectory, 1);
          const held = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
          );
          const rival = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
          );
          if (held) yield* Effect.promise(() => held.release());
          return rival;
        }),
      ),
    );

    it("hands back nothing", ({ aSecondAcquisitionWhileHeld }) => {
      expect(aSecondAcquisitionWhileHeld).toBe(null);
    });
  });

  describe("the only slot after its holder released it", () => {
    const it = slotTest.extend("anAcquisitionAfterRelease", ({ slotDirectory }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* ensureSlots(slotDirectory, 1);
          const held = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
          );
          if (held) yield* Effect.promise(() => held.release());
          const holdAfterRelease = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
          );
          if (holdAfterRelease) yield* Effect.promise(() => holdAfterRelease.release());
          return holdAfterRelease !== null;
        }),
      ),
    );

    it("hands back the slot again", ({ anAcquisitionAfterRelease }) => {
      expect(anAcquisitionAfterRelease).toBe(true);
    });
  });

  describe("a hold whose release is called more than once", () => {
    const it = slotTest
      .extend("theHoldTakenBeforeReleasingItTwice", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 1);
            const held = yield* Effect.promise(() =>
              tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
            );
            if (held) yield* Effect.promise(() => held.release());
            if (held) yield* Effect.promise(() => held.release());
            return held !== null;
          }),
        ),
      )
      .extend("theConcurrentReleaseIsTheFirstRelease", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 1);
            const held = yield* Effect.promise(() =>
              tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
            );
            const firstRelease = held?.release();
            const concurrentRelease = held?.release();
            yield* Effect.promise(() => Promise.all([firstRelease, concurrentRelease]));
            return concurrentRelease === firstRelease;
          }),
        ),
      )
      .extend("theBytesWrittenToADescriptorOpenedAfterTheRelease", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 1);
            const held = yield* Effect.promise(() =>
              tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
            );
            if (held) yield* Effect.promise(() => held.release());
            return yield* Effect.scoped(
              Effect.gen(function* () {
                const unrelated = yield* filesystem.open(paths.join(slotDirectory, "unrelated"), {
                  flag: "w",
                });
                if (held) yield* Effect.promise(() => held.release());
                return yield* unrelated.write(new TextEncoder().encode("still-open"));
              }),
            );
          }),
        ),
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
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 1);
            yield* removePath(paths.join(slotDirectory, "slot-0"));
            yield* makeDirectory(paths.join(slotDirectory, "slot-0"));
            return yield* Effect.tryPromise({
              try: () => tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
              catch: (refusal): boolean => failedWithCode(refusal, new Set(["EISDIR", "EPERM"])),
            }).pipe(
              Effect.matchEffect({
                onFailure: (coded) => Effect.succeed(coded),
                onSuccess: () => Effect.die("tryAcquireAny swallowed a marker it could not write"),
              }),
            );
          }),
        ),
      )
      .extend("aSlotHeldAfterAGenerationCouldNotBeRecorded", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 1);
            yield* removePath(paths.join(slotDirectory, "slot-0"));
            yield* makeDirectory(paths.join(slotDirectory, "slot-0"));
            yield* Effect.promise(() =>
              Promise.allSettled([tryAcquireAny({ slotDir: slotDirectory, limit: 1 })]),
            );
            yield* removePath(paths.join(slotDirectory, "slot-0"));
            yield* writeFileString({ location: paths.join(slotDirectory, "slot-0"), written: "" });
            const held = yield* Effect.promise(() =>
              tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
            );
            if (held) yield* Effect.promise(() => held.release());
            return held !== null;
          }),
        ),
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
    const temporarySlotDirectory = Effect.runPromise(
      filesystem.makeTempDirectory({ prefix: "throttle-slots-" }),
    );
    onCleanup(() =>
      Effect.runPromise(
        Effect.promise(() => temporarySlotDirectory).pipe(Effect.flatMap(removePath)),
      ),
    );
    return temporarySlotDirectory;
  });

  describe("two slots standing free", () => {
    const it = test.extend("theFingerprintOfFreeSlots", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const temporarySlotDirectory = yield* filesystem.makeTempDirectoryScoped({
            prefix: "throttle-slots-",
          });
          yield* ensureSlots(temporarySlotDirectory, 2);
          return yield* slotStateFingerprint(temporarySlotDirectory, 2);
        }).pipe(Effect.scoped, Effect.orDie),
      ));

    it("names every slot no one has taken yet as unused", ({ theFingerprintOfFreeSlots }) => {
      expect(theFingerprintOfFreeSlots).toBe("unused,unused");
    });
  });

  describe("one slot out of two taken", () => {
    const it = slotTest.extend("theFingerprintChangesOnceASlotIsHeld", ({ slotDirectory }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* ensureSlots(slotDirectory, 2);
          const free = yield* slotStateFingerprint(slotDirectory, 2);
          const held = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 2 }),
          );
          const taken = yield* slotStateFingerprint(slotDirectory, 2);
          if (held) yield* Effect.promise(() => held.release());
          return taken !== free;
        }),
      ),
    );

    it("changes once a slot is held", ({ theFingerprintChangesOnceASlotIsHeld }) => {
      expect(theFingerprintChangesOnceASlotIsHeld).toBe(true);
    });
  });

  describe("a slot its holder has let go", () => {
    const it = slotTest.extend("theFingerprintStandsAfterTheHolderLetGo", ({ slotDirectory }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* ensureSlots(slotDirectory, 2);
          const held = yield* Effect.promise(() =>
            tryAcquireAny({ slotDir: slotDirectory, limit: 2 }),
          );
          const whileHeld = yield* slotStateFingerprint(slotDirectory, 2);
          if (held) yield* Effect.promise(() => held.release());
          return (yield* slotStateFingerprint(slotDirectory, 2)) === whileHeld;
        }),
      ),
    );

    it("reads as it did while the slot was held", ({ theFingerprintStandsAfterTheHolderLetGo }) => {
      expect(theFingerprintStandsAfterTheHolderLetGo).toBe(true);
    });
  });

  describe("a slot taken, released and taken again", () => {
    const it = slotTest
      .extend("theFingerprintChangesWhenTheSlotIsTakenAnew", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 2);
            const first = yield* Effect.promise(() =>
              tryAcquireAny({ slotDir: slotDirectory, limit: 2 }),
            );
            const whileFirstHeld = yield* slotStateFingerprint(slotDirectory, 2);
            if (first) yield* Effect.promise(() => first.release());
            const second = yield* Effect.promise(() =>
              tryAcquireAny({ slotDir: slotDirectory, limit: 2 }),
            );
            const whileSecondHeld = yield* slotStateFingerprint(slotDirectory, 2);
            if (second) yield* Effect.promise(() => second.release());
            return whileSecondHeld !== whileFirstHeld;
          }),
        ),
      )
      .extend("theGenerationOfTheFirstSlotIsWrittenAnew", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 2);
            const first = yield* Effect.promise(() =>
              tryAcquireAny({ slotDir: slotDirectory, limit: 2 }),
            );
            const firstGeneration = yield* readFileString(paths.join(slotDirectory, "slot-0"));
            if (first) yield* Effect.promise(() => first.release());
            const second = yield* Effect.promise(() =>
              tryAcquireAny({ slotDir: slotDirectory, limit: 2 }),
            );
            const secondGeneration = yield* readFileString(paths.join(slotDirectory, "slot-0"));
            if (second) yield* Effect.promise(() => second.release());
            return secondGeneration !== firstGeneration;
          }),
        ),
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
    const it = test.extend("theFingerprintOfAMissingMarker", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const temporarySlotDirectory = yield* filesystem.makeTempDirectoryScoped({
            prefix: "throttle-slots-",
          });
          yield* ensureSlots(temporarySlotDirectory, 1);
          yield* removePath(paths.join(temporarySlotDirectory, "slot-0"));
          return yield* slotStateFingerprint(temporarySlotDirectory, 1);
        }).pipe(Effect.scoped, Effect.orDie),
      ));

    it("names the generation it could not read", ({ theFingerprintOfAMissingMarker }) => {
      expect(theFingerprintOfAMissingMarker).toBe("unreadable:ENOENT");
    });
  });
});

describe("a slot whose holder is killed without releasing it", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = Effect.runPromise(
      filesystem.makeTempDirectory({ prefix: "throttle-slots-" }),
    );
    onCleanup(() =>
      Effect.runPromise(
        Effect.promise(() => temporarySlotDirectory).pipe(Effect.flatMap(removePath)),
      ),
    );
    return temporarySlotDirectory;
  });

  describe("another process holding the only slot", () => {
    const it = slotTest
      .extend("theFirstWordOfTheHolder", ({ slotDirectory }, { onCleanup }) => {
        const scope = Scope.makeUnsafe();
        onCleanup(() => Effect.runPromise(Scope.close(scope, Exit.void)));
        return Effect.runPromise(
          Effect.gen(function* () {
            const holder = yield* spawner
              .spawn(
                ChildProcess.make(
                  process.execPath,
                  [
                    "-e",
                    HOLDER_SOURCE,
                    import.meta.resolve("effect"),
                    new URL("./slots.ts", import.meta.url).href,
                    slotDirectory,
                  ],
                  { detached: false, stdin: "ignore", stderr: "inherit" },
                ),
              )
              .pipe(Scope.provide(scope));
            const firstEmission = yield* Stream.runHead(Stream.decodeText(holder.stdout));
            return Option.getOrElse(firstEmission, () => "");
          }).pipe(Effect.orDie),
        );
      })
      .extend("aRivalWhileTheHolderLives", ({ slotDirectory }, { onCleanup }) => {
        const scope = Scope.makeUnsafe();
        onCleanup(() => Effect.runPromise(Scope.close(scope, Exit.void)));
        return Effect.runPromise(
          Effect.gen(function* () {
            const holder = yield* spawner
              .spawn(
                ChildProcess.make(
                  process.execPath,
                  [
                    "-e",
                    HOLDER_SOURCE,
                    import.meta.resolve("effect"),
                    new URL("./slots.ts", import.meta.url).href,
                    slotDirectory,
                  ],
                  { detached: false, stdin: "ignore", stderr: "inherit" },
                ),
              )
              .pipe(Scope.provide(scope));
            yield* Stream.runHead(holder.stdout);
            return yield* Effect.promise(() => tryAcquireAny({ slotDir: slotDirectory, limit: 1 }));
          }).pipe(Effect.orDie),
        );
      })
      .extend("aReplacementOnceTheHolderIsKilled", ({ slotDirectory }, { onCleanup }) => {
        const scope = Scope.makeUnsafe();
        onCleanup(() => Effect.runPromise(Scope.close(scope, Exit.void)));
        return Effect.runPromise(
          Effect.gen(function* () {
            const holder = yield* spawner
              .spawn(
                ChildProcess.make(
                  process.execPath,
                  [
                    "-e",
                    HOLDER_SOURCE,
                    import.meta.resolve("effect"),
                    new URL("./slots.ts", import.meta.url).href,
                    slotDirectory,
                  ],
                  { detached: false, stdin: "ignore", stderr: "inherit" },
                ),
              )
              .pipe(Scope.provide(scope));
            yield* Stream.runHead(holder.stdout);
            yield* holder.kill({ killSignal: "SIGKILL" });
            yield* childEndOf(holder);
            const replacement = yield* Effect.promise(() =>
              tryAcquireAny({ slotDir: slotDirectory, limit: 1 }),
            );
            if (replacement) yield* Effect.promise(() => replacement.release());
            return replacement !== null;
          }).pipe(Effect.orDie),
        );
      });

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
    const temporarySlotDirectory = Effect.runPromise(
      filesystem.makeTempDirectory({ prefix: "throttle-slots-" }),
    );
    onCleanup(() =>
      Effect.runPromise(
        Effect.promise(() => temporarySlotDirectory).pipe(Effect.flatMap(removePath)),
      ),
    );
    return temporarySlotDirectory;
  });

  describe("a queue holding this process's entry beside four planted ones", () => {
    const it = slotTest
      .extend("theSurvivorsBesideTheOwnWaiterEntry", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 1);
            const waiters = paths.join(slotDirectory, "waiters");
            yield* writeWaiterEntry(reserveWaiterPath(slotDirectory));
            yield* writeFileString({
              location: paths.join(waiters, "0000000000001-broken-aaaaaaaa"),
              written: "not a pid\n",
            });
            yield* makeDirectory(paths.join(waiters, "0000000000002-unreadable-bbbbbbbb"));
            yield* writeFileString({
              location: paths.join(waiters, "0000000000003-dead-cccccccc"),
              written: `${String(EXITED_PID)}\n`,
            });
            yield* writeFileString({
              location: paths.join(waiters, "0000000000004-root-dddddddd"),
              written: "1\n",
            });
            return (yield* sweepWaiters(slotDirectory)).slice(0, 1);
          }),
        ),
      )
      .extend("theOwnWaiterEntryIsTheLastSurvivor", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 1);
            const waiters = paths.join(slotDirectory, "waiters");
            const ownEntry = reserveWaiterPath(slotDirectory);
            yield* writeWaiterEntry(ownEntry);
            yield* writeFileString({
              location: paths.join(waiters, "0000000000001-broken-aaaaaaaa"),
              written: "not a pid\n",
            });
            yield* makeDirectory(paths.join(waiters, "0000000000002-unreadable-bbbbbbbb"));
            yield* writeFileString({
              location: paths.join(waiters, "0000000000003-dead-cccccccc"),
              written: `${String(EXITED_PID)}\n`,
            });
            yield* writeFileString({
              location: paths.join(waiters, "0000000000004-root-dddddddd"),
              written: "1\n",
            });
            return (yield* sweepWaiters(slotDirectory)).at(-1) === paths.basename(ownEntry);
          }),
        ),
      )
      .extend("theWaitersLeftOnDiskThatSweepingDidNotKeep", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 1);
            const waiters = paths.join(slotDirectory, "waiters");
            yield* writeWaiterEntry(reserveWaiterPath(slotDirectory));
            yield* writeFileString({
              location: paths.join(waiters, "0000000000001-broken-aaaaaaaa"),
              written: "not a pid\n",
            });
            yield* makeDirectory(paths.join(waiters, "0000000000002-unreadable-bbbbbbbb"));
            yield* writeFileString({
              location: paths.join(waiters, "0000000000003-dead-cccccccc"),
              written: `${String(EXITED_PID)}\n`,
            });
            yield* writeFileString({
              location: paths.join(waiters, "0000000000004-root-dddddddd"),
              written: "1\n",
            });
            const survivors = yield* sweepWaiters(slotDirectory);
            return (yield* readDirectory(waiters)).filter(
              (waiterFilename) => !survivors.includes(waiterFilename),
            );
          }),
        ),
      )
      .extend("theSurvivorsSweepingKeptThatAreGoneFromDisk", ({ slotDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* ensureSlots(slotDirectory, 1);
            const waiters = paths.join(slotDirectory, "waiters");
            yield* writeWaiterEntry(reserveWaiterPath(slotDirectory));
            yield* writeFileString({
              location: paths.join(waiters, "0000000000001-broken-aaaaaaaa"),
              written: "not a pid\n",
            });
            yield* makeDirectory(paths.join(waiters, "0000000000002-unreadable-bbbbbbbb"));
            yield* writeFileString({
              location: paths.join(waiters, "0000000000003-dead-cccccccc"),
              written: `${String(EXITED_PID)}\n`,
            });
            yield* writeFileString({
              location: paths.join(waiters, "0000000000004-root-dddddddd"),
              written: "1\n",
            });
            const survivors = yield* sweepWaiters(slotDirectory);
            const onDisk = yield* readDirectory(waiters);
            return survivors.filter(
              (survivingWaiterFilename) => !onDisk.includes(survivingWaiterFilename),
            );
          }),
        ),
      );

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
    const temporarySlotDirectory = Effect.runPromise(
      filesystem.makeTempDirectory({ prefix: "throttle-slots-" }),
    );
    onCleanup(() =>
      Effect.runPromise(
        Effect.promise(() => temporarySlotDirectory).pipe(Effect.flatMap(removePath)),
      ),
    );
    return temporarySlotDirectory;
  });

  describe("an entry removed twice", () => {
    const it = slotTest.extend("theWaitersLeftAfterRemovingTwice", ({ slotDirectory }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* ensureSlots(slotDirectory, 1);
          const waiterEntry = reserveWaiterPath(slotDirectory);
          yield* writeWaiterEntry(waiterEntry);
          yield* removeWaiter(waiterEntry);
          yield* removeWaiter(waiterEntry);
          return yield* readDirectory(paths.join(slotDirectory, "waiters"));
        }),
      ),
    );

    it("tolerates an entry that is already gone", ({ theWaitersLeftAfterRemovingTwice }) => {
      expect(theWaitersLeftAfterRemovingTwice).toStrictEqual([]);
    });
  });
});

describe("reserveWaiterPath with writeWaiterEntry", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = Effect.runPromise(
      filesystem.makeTempDirectory({ prefix: "throttle-slots-" }),
    );
    onCleanup(() =>
      Effect.runPromise(
        Effect.promise(() => temporarySlotDirectory).pipe(Effect.flatMap(removePath)),
      ),
    );
    return temporarySlotDirectory;
  });

  describe("two entries written in turn", () => {
    const it = slotTest.extend("theSurvivorsOfTwoWaitersWrittenInTurn", ({ slotDirectory }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* ensureSlots(slotDirectory, 1);
          const first = reserveWaiterPath(slotDirectory);
          yield* writeWaiterEntry(first);
          yield* Effect.sleep("5 millis");
          const second = reserveWaiterPath(slotDirectory);
          yield* writeWaiterEntry(second);
          return (
            (yield* sweepWaiters(slotDirectory)).join("\n") ===
            [first, second].map((writtenWaiter) => paths.basename(writtenWaiter)).join("\n")
          );
        }),
      ),
    );

    it("names them so they sort by creation order", ({ theSurvivorsOfTwoWaitersWrittenInTurn }) => {
      expect(theSurvivorsOfTwoWaitersWrittenInTurn).toBe(true);
    });
  });
});

describe("a slot directory this process may not read", () => {
  describe("a fingerprint read off a directory closed to this process", () => {
    const it = test.extend("theFingerprintOfAClosedSlotDirectory", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const temporarySlotDirectory = yield* filesystem.makeTempDirectoryScoped({
            prefix: "throttle-slots-",
          });
          yield* ensureSlots(temporarySlotDirectory, 1);
          yield* filesystem.chmod(temporarySlotDirectory, 0o000);
          const closedFingerprint = yield* slotStateFingerprint(temporarySlotDirectory, 1);
          yield* filesystem.chmod(temporarySlotDirectory, 0o700);
          return closedFingerprint;
        }).pipe(Effect.scoped, Effect.orDie),
      ));

    it("names the refusal rather than reading it as an unused slot", ({
      theFingerprintOfAClosedSlotDirectory,
    }) => {
      expect(theFingerprintOfAClosedSlotDirectory).toBe("unreadable:EACCES");
    });
  });

  describe("a sweep over an entry closed to this process", () => {
    const it = test.extend("theRefusalOfAClosedWaiterEntry", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const temporarySlotDirectory = yield* filesystem.makeTempDirectoryScoped({
            prefix: "throttle-slots-",
          });
          yield* ensureSlots(temporarySlotDirectory, 1);
          const closedWaiter = reserveWaiterPath(temporarySlotDirectory);
          yield* writeWaiterEntry(closedWaiter);
          yield* filesystem.chmod(closedWaiter, 0o000);
          return yield* sweepWaiters(temporarySlotDirectory).pipe(
            Effect.match({
              onFailure: (refused) => refused.message.split(",")[0],
              onSuccess: (survivors) => survivors,
            }),
          );
        }).pipe(Effect.scoped, Effect.orDie),
      ));

    it("hands the refusal on rather than reading it as an entry with no owner", ({
      theRefusalOfAClosedWaiterEntry,
    }) => {
      expect(theRefusalOfAClosedWaiterEntry).toBe("EACCES: permission denied");
    });
  });
});
