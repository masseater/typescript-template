import { Effect, Schema } from "effect";
import { Stage, inMemoryState } from "alchemy";
import { stackName, stage } from "./stacks.ts";
import type { StackName } from "./stacks.ts";
import { providers } from "alchemy/Cloudflare";
import { toEffect } from "alchemy/Test/Core";
import { verificationEnvironment } from "./verification-fixture.ts";

interface StackInventory {
  readonly bindings: Readonly<Record<string, readonly string[]>>;
  readonly name: string;
  readonly resources: Readonly<Record<string, string>>;
  readonly stack: StackName;
}

class InventoryFailure extends Schema.TaggedError<InventoryFailure>()("InventoryFailure", {
  code: Schema.Literals(["stack_module_invalid", "stack_compilation_failed"]),
  stack: Schema.String,
}) {}

const BindingShape = Schema.Struct({ sid: Schema.String });
const ResourceShape = Schema.Struct({ Type: Schema.String });
const CompiledShape = Schema.Struct({
  bindings: Schema.Record(Schema.String, Schema.Array(BindingShape)),
  name: Schema.String,
  resources: Schema.Record(Schema.String, ResourceShape),
});

function applyVerificationEnvironment(): void {
  for (const [name, value] of Object.entries(verificationEnvironment)) {
    // oxlint-disable-next-line node/no-process-env
    process.env[name] ??= value;
  }
}

type StackProgram = Parameters<typeof toEffect>[0];

function stackProgram(module: unknown): StackProgram | undefined {
  const program: unknown =
    typeof module === "object" && module !== null ? Reflect.get(module, "default") : undefined;
  return Effect.isEffect(program) ? (program as StackProgram) : undefined;
}

function inventoryOf(stack: StackName, shape: typeof CompiledShape.Type): StackInventory {
  return {
    bindings: Object.fromEntries(
      Object.entries(shape.bindings).map(
        ([resource, bindings]: readonly [string, readonly { readonly sid: string }[]]) => [
          resource,
          bindings.map(({ sid }) => sid).toSorted(),
        ],
      ),
    ),
    name: shape.name,
    resources: Object.fromEntries(
      Object.entries(shape.resources).map(
        ([resource, { Type }]: readonly [string, { readonly Type: string }]) => [resource, Type],
      ),
    ),
    stack,
  };
}

const compileStack = Effect.fn("compileStack")(function* compileStack(stack: StackName) {
  const invalid = new InventoryFailure({ code: "stack_module_invalid", stack });
  const module: unknown = yield* Effect.tryPromise({
    catch: () => invalid,
    try: async (): Promise<unknown> => import(`./${stack}.ts`),
  });
  const program = stackProgram(module);
  if (program === undefined) {
    return yield* Effect.fail(invalid);
  }
  const compiled: unknown = yield* Effect.tryPromise({
    catch: () => new InventoryFailure({ code: "stack_compilation_failed", stack }),
    try: async () =>
      Effect.runPromise(
        toEffect(Effect.provideService(program, Stage, stage), {
          providers: providers(),
          state: inMemoryState(),
        }),
      ),
  });
  const shape = yield* Schema.decodeUnknownEffect(CompiledShape)(compiled).pipe(
    Effect.mapError(() => new InventoryFailure({ code: "stack_compilation_failed", stack })),
  );
  if (shape.name !== stackName(stack)) {
    return yield* Effect.fail(invalid);
  }
  return inventoryOf(stack, shape);
});

export { applyVerificationEnvironment, compileStack };
