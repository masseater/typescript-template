import { env as processEnvironment } from "node:process";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { waitEmitterEvent } from "../emitter-wait.ts";
import { joinPath, readDirectory, removePath } from "../host.ts";
import { CHILD_PROCESS_EVENT } from "../node-event-names.ts";
import { spawnChild } from "../node-spawn.ts";
import { ensureSlots, tryAcquireAny } from "./slots.ts";

const nodeFs = process.getBuiltinModule("fs") as {
  readonly mkdtempSync: (prefix: string) => string;
  readonly realpathSync: (location: string) => string;
};

const nodeOs = process.getBuiltinModule("os") as {
  readonly tmpdir: () => string;
};

type ChildExit = readonly [number | null, NodeJS.Signals | null];

const streamConsumers = process.getBuiltinModule("stream/consumers") as {
  readonly text: (readable: unknown) => Promise<string>;
};

const CLI_PATH = fileURLToPath(new URL("./cli.ts", import.meta.url));

const TWO_STREAM_SCRIPT =
  "process.stdout.write('alpha\\nbeta\\n'); process.stderr.write('gamma\\ndelta\\n');";

describe("cli", () => {
  describe("a call that names no command", () => {
    const it = test.extend("theWayThrottleAnswersACallWithoutACommand", ({}, { onCleanup }) => {
      const tmpRoot = nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "throttle-cli-tmp-"));
      onCleanup(() => {
        removePath(tmpRoot);
      });
      const child = spawnChild({
        executable: process.execPath,
        handed: [CLI_PATH],
        spawnOptions: {
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...processEnvironment, TMPDIR: tmpRoot },
        },
      });
      return Promise.all([
        waitEmitterEvent<ChildExit>(child, CHILD_PROCESS_EVENT.exit),
        streamConsumers.text(child.stdout),
        streamConsumers.text(child.stderr),
      ]);
    });

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
      const it = test.extend("theWayNodeRunsItOnItsOwn", () => {
        const child = spawnChild({
          executable: process.execPath,
          handed: ["-e", TWO_STREAM_SCRIPT],
          spawnOptions: {
            stdio: ["ignore", "pipe", "pipe"],
          },
        });
        return Promise.all([
          waitEmitterEvent<ChildExit>(child, CHILD_PROCESS_EVENT.exit),
          streamConsumers.text(child.stdout),
          streamConsumers.text(child.stderr),
        ]);
      });

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
      const it = test.extend("theWayThrottleRunsIt", ({}, { onCleanup }) => {
        const tmpRoot = nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "throttle-cli-tmp-"));
        onCleanup(() => {
          removePath(tmpRoot);
        });
        const child = spawnChild({
          executable: process.execPath,
          handed: [CLI_PATH, "--", process.execPath, "-e", TWO_STREAM_SCRIPT],
          spawnOptions: {
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...processEnvironment, TMPDIR: tmpRoot, MST_THROTTLE_LIMIT: "1" },
          },
        });
        return Promise.all([
          waitEmitterEvent<ChildExit>(child, CHILD_PROCESS_EVENT.exit),
          streamConsumers.text(child.stdout),
          streamConsumers.text(child.stderr),
        ]);
      });

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
      const it = test.extend("theWayAWaitingWrapperEnds", ({}, { onCleanup }) => {
        const tmpRoot = nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "throttle-cli-tmp-"));
        onCleanup(() => {
          removePath(tmpRoot);
        });
        return Effect.runPromise(
          Effect.gen(function* () {
            const slotDir = joinPath(tmpRoot, "mst-throttle", "mst");
            ensureSlots(slotDir, 1);
            const holdTheOnlySlot = (): Effect.Effect<() => Promise<void>> =>
              Effect.gen(function* () {
                const held = yield* Effect.promise(() => tryAcquireAny({ slotDir, limit: 1 }));
                if (held !== null) return held.release;
                yield* Effect.sleep("200 millis");
                return yield* holdTheOnlySlot();
              });
            const release = yield* holdTheOnlySlot();
            const child = spawnChild({
              executable: process.execPath,
              handed: [CLI_PATH, "--", process.execPath, "-e", ""],
              spawnOptions: {
                stdio: ["ignore", "pipe", "pipe"],
                env: { ...processEnvironment, TMPDIR: tmpRoot, MST_THROTTLE_LIMIT: "1" },
              },
            });
            const waitersDir = joinPath(slotDir, "waiters");
            const ownEntries = (): string[] =>
              readDirectory(waitersDir).filter((waiterFileName) =>
                waiterFileName.includes(`-${String(child.pid)}-`),
              );
            const untilEnqueued = (): Effect.Effect<void> =>
              Effect.gen(function* () {
                if (ownEntries().length === 1) return;
                yield* Effect.sleep("100 millis");
                return yield* untilEnqueued();
              });
            yield* untilEnqueued();
            child.kill("SIGTERM");
            const { stdout } = child;
            if (stdout === null) throw new Error("stdout was not piped");
            const ended = yield* Effect.promise(() =>
              Promise.all([
                waitEmitterEvent<ChildExit>(child, CHILD_PROCESS_EVENT.exit),
                streamConsumers.text(stdout),
              ]),
            );
            yield* Effect.promise(() => release());
            return ended;
          }),
        );
      });

      it(
        "dies of the signal it was sent, having written nothing to stdout",
        { timeout: 30_000 },
        ({ theWayAWaitingWrapperEnds }) => {
          expect(theWayAWaitingWrapperEnds).toStrictEqual([[null, "SIGTERM"], ""]);
        },
      );
    });

    describe("once a SIGTERM has ended it", () => {
      const it = test.extend("theQueueEntriesOfAKilledWrapper", ({}, { onCleanup }) => {
        const tmpRoot = nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "throttle-cli-tmp-"));
        onCleanup(() => {
          removePath(tmpRoot);
        });
        return Effect.runPromise(
          Effect.gen(function* () {
            const slotDir = joinPath(tmpRoot, "mst-throttle", "mst");
            ensureSlots(slotDir, 1);
            const holdTheOnlySlot = (): Effect.Effect<() => Promise<void>> =>
              Effect.gen(function* () {
                const held = yield* Effect.promise(() => tryAcquireAny({ slotDir, limit: 1 }));
                if (held !== null) return held.release;
                yield* Effect.sleep("200 millis");
                return yield* holdTheOnlySlot();
              });
            const release = yield* holdTheOnlySlot();
            const child = spawnChild({
              executable: process.execPath,
              handed: [CLI_PATH, "--", process.execPath, "-e", ""],
              spawnOptions: {
                stdio: ["ignore", "pipe", "pipe"],
                env: { ...processEnvironment, TMPDIR: tmpRoot, MST_THROTTLE_LIMIT: "1" },
              },
            });
            const waitersDir = joinPath(slotDir, "waiters");
            const ownEntries = (): string[] =>
              readDirectory(waitersDir).filter((waiterFileName) =>
                waiterFileName.includes(`-${String(child.pid)}-`),
              );
            const untilEnqueued = (): Effect.Effect<void> =>
              Effect.gen(function* () {
                if (ownEntries().length === 1) return;
                yield* Effect.sleep("100 millis");
                return yield* untilEnqueued();
              });
            yield* untilEnqueued();
            child.kill("SIGTERM");
            yield* Effect.promise(() =>
              waitEmitterEvent<ChildExit>(child, CHILD_PROCESS_EVENT.exit),
            );
            const untilDrained = (): Effect.Effect<void> =>
              Effect.gen(function* () {
                if (ownEntries().length === 0) return;
                yield* Effect.sleep("100 millis");
                return yield* untilDrained();
              });
            yield* untilDrained();
            const drained = ownEntries();
            yield* Effect.promise(() => release());
            return drained;
          }),
        );
      });

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
