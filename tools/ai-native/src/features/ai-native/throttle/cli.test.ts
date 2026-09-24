import { Effect, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { describe, expect, test } from "vite-plus/test";

import { childEndOf } from "../child-process.ts";
import { filesystem, joinPath, readDirectory, spawner } from "../host.ts";
import { ensureSlots, tryAcquireAny } from "./slots.ts";

const CLI_PATH = joinPath(import.meta.dirname, "cli.ts");

const TWO_STREAM_SCRIPT =
  "process.stdout.write('alpha\\nbeta\\n'); process.stderr.write('gamma\\ndelta\\n');";

describe("cli", () => {
  describe("a call that names no command", () => {
    const it = test.extend("theWayThrottleAnswersACallWithoutACommand", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const tmpRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "throttle-cli-tmp-",
          });
          const child = yield* spawner.spawn(
            ChildProcess.make(process.execPath, [CLI_PATH], {
              env: { TMPDIR: tmpRoot },
              extendEnv: true,
              detached: false,
              stdin: "ignore",
            }),
          );
          const [stdout, stderr] = yield* Effect.all(
            [
              Stream.mkString(Stream.decodeText(child.stdout)),
              Stream.mkString(Stream.decodeText(child.stderr)),
            ],
            { concurrency: "unbounded" },
          );
          const end = yield* childEndOf(child);
          return [[end.code, end.signal], stdout, stderr];
        }).pipe(Effect.scoped, Effect.orDie),
      ));

    it(
      "exits 2 with nothing on stdout and the usage on stderr",
      { timeout: 20_000 },
      ({ theWayThrottleAnswersACallWithoutACommand }) => {
        expect(theWayThrottleAnswersACallWithoutACommand).toMatchInlineSnapshot(`
          [
            [
              2,
              null,
            ],
            "",
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
          ",
          ]
        `);
      },
    );
  });

  describe("a command that writes to both of its streams", () => {
    describe("started without the wrapper", () => {
      const it = test.extend("theWayNodeRunsItOnItsOwn", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const child = yield* spawner.spawn(
              ChildProcess.make(process.execPath, ["-e", TWO_STREAM_SCRIPT], {
                detached: false,
                stdin: "ignore",
              }),
            );
            const [stdout, stderr] = yield* Effect.all(
              [
                Stream.mkString(Stream.decodeText(child.stdout)),
                Stream.mkString(Stream.decodeText(child.stderr)),
              ],
              { concurrency: "unbounded" },
            );
            const end = yield* childEndOf(child);
            return [[end.code, end.signal], stdout, stderr];
          }).pipe(Effect.scoped, Effect.orDie),
        ));

      it(
        "exits zero after writing two lines to each stream",
        { timeout: 30_000 },
        ({ theWayNodeRunsItOnItsOwn }) => {
          expect(theWayNodeRunsItOnItsOwn).toStrictEqual([
            [0, null],
            "alpha\nbeta\n",
            "gamma\ndelta\n",
          ]);
        },
      );
    });

    describe("started through the wrapper", () => {
      const it = test.extend("theWayThrottleRunsIt", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const tmpRoot = yield* filesystem.makeTempDirectoryScoped({
              prefix: "throttle-cli-tmp-",
            });
            const child = yield* spawner.spawn(
              ChildProcess.make(
                process.execPath,
                [CLI_PATH, "--", process.execPath, "-e", TWO_STREAM_SCRIPT],
                {
                  env: { TMPDIR: tmpRoot, MST_THROTTLE_LIMIT: "1" },
                  extendEnv: true,
                  detached: false,
                  stdin: "ignore",
                },
              ),
            );
            const [stdout, stderr] = yield* Effect.all(
              [
                Stream.mkString(Stream.decodeText(child.stdout)),
                Stream.mkString(Stream.decodeText(child.stderr)),
              ],
              { concurrency: "unbounded" },
            );
            const end = yield* childEndOf(child);
            return [[end.code, end.signal], stdout, stderr];
          }).pipe(Effect.scoped, Effect.orDie),
        ));

      it(
        "hands both streams through byte for byte and adds only its own lines to stderr",
        { timeout: 30_000 },
        ({ theWayThrottleRunsIt }) => {
          expect(theWayThrottleRunsIt).toStrictEqual([
            [0, null],
            "alpha\nbeta\n",
            `throttle: acquiring a slot (limit 1)\nthrottle: run ${process.execPath} -e ${TWO_STREAM_SCRIPT}\ngamma\ndelta\n`,
          ]);
        },
      );
    });
  });

  describe("a wrapper left waiting because the only slot is held", () => {
    describe("when a SIGTERM reaches it", () => {
      const it = test.extend("theWayAWaitingWrapperEnds", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const tmpRoot = yield* filesystem.makeTempDirectoryScoped({
              prefix: "throttle-cli-tmp-",
            });
            const slotDir = joinPath(tmpRoot, "mst-throttle", "mst");
            yield* ensureSlots(slotDir, 1);
            const holdTheOnlySlot = (): Effect.Effect<() => Promise<void>> =>
              Effect.gen(function* () {
                const held = yield* Effect.promise(() => tryAcquireAny({ slotDir, limit: 1 }));
                if (held !== null) return held.release;
                yield* Effect.sleep("200 millis");
                return yield* holdTheOnlySlot();
              });
            const release = yield* holdTheOnlySlot();
            const child = yield* spawner.spawn(
              ChildProcess.make(process.execPath, [CLI_PATH, "--", process.execPath, "-e", ""], {
                env: { TMPDIR: tmpRoot, MST_THROTTLE_LIMIT: "1" },
                extendEnv: true,
                detached: false,
                stdin: "ignore",
              }),
            );
            const waitersDir = joinPath(slotDir, "waiters");
            const ownEntries = readDirectory(waitersDir).pipe(
              Effect.map((waiterFileNames) =>
                waiterFileNames.filter((waiterFileName) =>
                  waiterFileName.includes(`-${String(child.pid)}-`),
                ),
              ),
            );
            const untilEnqueued = (): Effect.Effect<void, Error> =>
              Effect.gen(function* () {
                if ((yield* ownEntries).length === 1) return;
                yield* Effect.sleep("100 millis");
                return yield* untilEnqueued();
              });
            yield* untilEnqueued();
            const ended = yield* Effect.all(
              [
                child.kill({ killSignal: "SIGTERM" }).pipe(
                  Effect.andThen(childEndOf(child)),
                  Effect.map((end) => [end.code, end.signal]),
                ),
                Stream.mkString(Stream.decodeText(child.stdout)),
              ],
              { concurrency: "unbounded" },
            );
            yield* Effect.promise(() => release());
            return ended;
          }).pipe(Effect.scoped, Effect.orDie),
        ));

      it(
        "dies of the signal it was sent, having written nothing to stdout",
        { timeout: 30_000 },
        ({ theWayAWaitingWrapperEnds }) => {
          expect(theWayAWaitingWrapperEnds).toStrictEqual([[null, "SIGTERM"], ""]);
        },
      );
    });

    describe("once a SIGTERM has ended it", () => {
      const it = test.extend("theQueueEntriesOfAKilledWrapper", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const tmpRoot = yield* filesystem.makeTempDirectoryScoped({
              prefix: "throttle-cli-tmp-",
            });
            const slotDir = joinPath(tmpRoot, "mst-throttle", "mst");
            yield* ensureSlots(slotDir, 1);
            const holdTheOnlySlot = (): Effect.Effect<() => Promise<void>> =>
              Effect.gen(function* () {
                const held = yield* Effect.promise(() => tryAcquireAny({ slotDir, limit: 1 }));
                if (held !== null) return held.release;
                yield* Effect.sleep("200 millis");
                return yield* holdTheOnlySlot();
              });
            const release = yield* holdTheOnlySlot();
            const child = yield* spawner.spawn(
              ChildProcess.make(process.execPath, [CLI_PATH, "--", process.execPath, "-e", ""], {
                env: { TMPDIR: tmpRoot, MST_THROTTLE_LIMIT: "1" },
                extendEnv: true,
                detached: false,
                stdin: "ignore",
              }),
            );
            const waitersDir = joinPath(slotDir, "waiters");
            const ownEntries = readDirectory(waitersDir).pipe(
              Effect.map((waiterFileNames) =>
                waiterFileNames.filter((waiterFileName) =>
                  waiterFileName.includes(`-${String(child.pid)}-`),
                ),
              ),
            );
            const untilEnqueued = (): Effect.Effect<void, Error> =>
              Effect.gen(function* () {
                if ((yield* ownEntries).length === 1) return;
                yield* Effect.sleep("100 millis");
                return yield* untilEnqueued();
              });
            yield* untilEnqueued();
            yield* child.kill({ killSignal: "SIGTERM" });
            yield* childEndOf(child);
            const untilDrained = (): Effect.Effect<void, Error> =>
              Effect.gen(function* () {
                if ((yield* ownEntries).length === 0) return;
                yield* Effect.sleep("100 millis");
                return yield* untilDrained();
              });
            yield* untilDrained();
            const drained = yield* ownEntries;
            yield* Effect.promise(() => release());
            return drained;
          }).pipe(Effect.scoped, Effect.orDie),
        ));

      it(
        "has taken its own entry out of the wait queue",
        { timeout: 30_000 },
        ({ theQueueEntriesOfAKilledWrapper }) => {
          expect(theQueueEntriesOfAKilledWrapper).toStrictEqual([]);
        },
      );
    });
  });
});
