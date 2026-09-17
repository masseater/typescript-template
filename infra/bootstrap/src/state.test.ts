import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { validateOutputRead, validateStateCommand } from "./state.ts";

it.effect("reads only the public database target outputs", () =>
  Effect.gen(function* () {
    yield* validateOutputRead("databaseId");
    yield* validateOutputRead("applicationSettings");
    const failure = yield* validateOutputRead("authSecret").pipe(Effect.flip);
    assert.strictEqual(failure.code, "state_output_not_allowed");
  }),
);

it.effect("permits deployment commands without secret output", () =>
  Effect.gen(function* () {
    yield* validateStateCommand(["preview", "--cwd", "project"]);
    yield* validateStateCommand(["config", "set", "authSecret", "--secret"]);
  }),
);

for (const { args, error } of [
  { args: ["stack", "output", "--show-secrets"], error: "plaintext_secret_output_forbidden" },
  { args: ["up", "--show-secrets=true"], error: "plaintext_secret_output_forbidden" },
  { args: ["config", "get", "authSecret"], error: "state_command_not_allowed" },
  { args: ["stack", "export"], error: "state_command_not_allowed" },
  { args: ["login"], error: "state_command_not_allowed" },
  { args: ["up", "--plaintext"], error: "plaintext_secret_output_forbidden" },
  { args: ["up", "-v=9"], error: "plaintext_secret_output_forbidden" },
  { args: ["up", "--logtostderr"], error: "plaintext_secret_output_forbidden" },
  { args: ["up", "--tracing", "file:trace"], error: "plaintext_secret_output_forbidden" },
])
  it.effect(`refuses secret output or backend switching: ${args.join(" ")}`, () =>
    Effect.gen(function* () {
      const failure = yield* validateStateCommand(args).pipe(Effect.flip);
      assert.strictEqual(failure.code, error);
    }),
  );
