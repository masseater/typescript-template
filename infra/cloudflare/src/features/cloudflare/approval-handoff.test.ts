import { assert, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

import { handOffApproval } from "./approval-handoff.ts";
import { layer } from "./platform.ts";

const pending = { confirmation: "c324b447995b8447", stack: "flagship" } as const;

it.effect("hands the stack and confirmation that wait for approval to the workflow", () =>
  Effect.gen(function* program() {
    const filesystem = yield* FileSystem.FileSystem;
    const output = yield* filesystem.makeTempFileScoped();
    yield* filesystem.writeFileString(output, "configured=true\n");
    assert.isTrue(yield* handOffApproval(pending, output));
    assert.strictEqual(
      yield* filesystem.readFileString(output),
      "configured=true\napproval-stack=flagship\napproval-confirmation=c324b447995b8447\n",
    );
  }).pipe(Effect.provide(layer), Effect.scoped),
);

it.effect("leaves the refusal to the caller when no workflow can take the approval", () =>
  Effect.gen(function* program() {
    assert.isFalse(yield* handOffApproval(pending, undefined));
    assert.isFalse(yield* handOffApproval(pending, ""));
  }),
);

it.effect("reports an output file it cannot append to", () =>
  Effect.gen(function* program() {
    const filesystem = yield* FileSystem.FileSystem;
    const directory = yield* filesystem.makeTempDirectoryScoped();
    const failure = yield* handOffApproval(pending, directory).pipe(Effect.flip);
    assert.strictEqual(failure.code, "approval_handoff_unwritable");
    assert.deepStrictEqual(failure.keys, ["flagship"]);
  }).pipe(Effect.provide(layer), Effect.scoped),
);
