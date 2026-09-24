import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { runCommand } from "citty";
import { Effect, Schema } from "effect";
import { expect } from "vite-plus/test";

import { dontReviewItCommand } from "../src/features/dont-review-it/dont-review-it-command.ts";
import { EXIT_MISUSE } from "../src/features/dont-review-it/repository-checks/index.ts";

class CommandRejected extends Schema.TaggedError<CommandRejected>()("CommandRejected", {
  reason: Schema.String,
}) {}

layer(NodeServices.layer)("リポジトリ検査の入口", (it) => {
  it.effect("check 以外の命令を名指しで拒否する", () =>
    Effect.gen(function* program() {
      const rejection = yield* Effect.flip(
        Effect.tryPromise({
          try: () => runCommand(dontReviewItCommand, { rawArgs: ["deploy"] }),
          catch: (rejected) =>
            new CommandRejected({
              reason: rejected instanceof Error ? rejected.message : String(rejected),
            }),
        }),
      );
      expect(rejection.reason).toMatch(/Unknown command/u);
    }),
  );

  it.effect("存在しない場所を検査対象に取らない", () =>
    Effect.gen(function* program() {
      process.exitCode = 0;
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, {
          rawArgs: ["check", "--repository-root", "/nonexistent/verified-specifications-probe"],
        }),
      );

      expect(process.exitCode).toBe(EXIT_MISUSE);
      process.exitCode = 0;
    }),
  );
});
