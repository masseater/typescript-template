import { Effect } from "effect";

import { failed } from "./journey-failure.ts";

import type { ChildProcessSpawner } from "effect/unstable/process";

const killGroup = (pid: number, signal: "SIGKILL" | "SIGTERM"): Effect.Effect<void> =>
  Effect.try({
    try: () => {
      process.kill(-pid, signal);
    },
    catch: (unsignalled) => failed("E2E_PROCESS_GROUP_UNSIGNALLED", unsignalled),
  }).pipe(Effect.ignore);

const stopGroup = (
  handle: ChildProcessSpawner.ChildProcessHandle,
): Effect.Effect<void, never, ChildProcessSpawner.ChildProcessSpawner> =>
  Effect.gen(function* stopProcessGroup() {
    const pid = Number(handle.pid);
    yield* killGroup(pid, "SIGTERM");
    yield* handle.exitCode.pipe(
      Effect.asVoid,
      Effect.ignore,
      Effect.timeout("30 seconds"),
      Effect.ignore,
    );
    yield* killGroup(pid, "SIGKILL");
  });

export { stopGroup };
