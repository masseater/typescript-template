import { Effect, Schema } from "effect";
import { Stage, inMemoryState } from "alchemy";
import { verificationEnvironment, verificationSettings } from "./verification-fixture.ts";
import type { StackName } from "./stacks.ts";
import { providers } from "alchemy/Cloudflare";
import { repositoryRoot } from "./artifacts.ts";
import { stackName } from "./stacks.ts";
import { toEffect } from "alchemy/Test/Core";

interface ResourceInventory {
  readonly adopt: boolean;
  readonly bindings: readonly string[];
  readonly declared: unknown;
  readonly removalPolicy: string;
  readonly type: string;
}

interface StackInventory {
  readonly name: string;
  readonly resources: Readonly<Record<string, ResourceInventory>>;
}

class InventoryFailure extends Schema.TaggedError<InventoryFailure>()("InventoryFailure", {
  code: Schema.Literals(["stack_module_invalid", "stack_compilation_failed"]),
  stack: Schema.String,
}) {}

const BindingEntry = Schema.Struct({
  data: Schema.Struct({ bindings: Schema.Array(Schema.Unknown) }),
  sid: Schema.String,
});
const ResourceShape = Schema.Struct({
  Adopt: Schema.Boolean,
  Props: Schema.Record(Schema.String, Schema.Unknown),
  RemovalPolicy: Schema.String,
  Type: Schema.String,
});
const CompiledShape = Schema.Struct({
  bindings: Schema.Record(Schema.String, Schema.Array(BindingEntry)),
  name: Schema.String,
  resources: Schema.Record(Schema.String, ResourceShape),
});

const declaredProperties = [
  "assets",
  "bundle",
  "compatibility",
  "crons",
  "domain",
  "main",
  "name",
  "observability",
  "policies",
  "rules",
  "workersDev",
] as const;

const DIGEST_SEGMENT = /\/[0-9a-f]{64}\//u;

function declaredValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(repositoryRoot, "").replace(DIGEST_SEGMENT, "/<digest>/");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(
      ([key, nested]: readonly [string, unknown]) => [key, declaredValue(nested)] as const,
    ),
  );
}

function applyVerificationEnvironment(): void {
  for (const [name, value] of Object.entries(verificationEnvironment)) {
    // oxlint-disable-next-line node/no-process-env
    process.env[name] = value;
  }
}

function describeBinding(entry: typeof BindingEntry.Type): string {
  const [binding] = entry.data.bindings;
  if (typeof binding !== "object" || binding === null) {
    return `${entry.sid}:deferred`;
  }
  const kind: unknown = Reflect.get(binding, "type");
  const className: unknown = Reflect.get(binding, "className");
  return typeof className === "string"
    ? `${entry.sid}:${String(kind)}:${className}`
    : `${entry.sid}:${String(kind)}`;
}

function declaredOf(props: Readonly<Record<string, unknown>>): unknown {
  return Object.fromEntries(
    declaredProperties.flatMap((property) =>
      Object.hasOwn(props, property) ? [[property, declaredValue(props[property])]] : [],
    ),
  );
}

function inventoryOf(shape: typeof CompiledShape.Type): StackInventory {
  return {
    name: shape.name,
    resources: Object.fromEntries(
      Object.entries(shape.resources).map(
        ([id, resource]: readonly [string, typeof ResourceShape.Type]) => [
          id,
          {
            adopt: resource.Adopt,
            bindings: (shape.bindings[id] ?? []).map((entry) => describeBinding(entry)).toSorted(),
            declared: declaredOf(resource.Props),
            removalPolicy: resource.RemovalPolicy,
            type: resource.Type,
          },
        ],
      ),
    ),
  };
}

type StackProgram = Parameters<typeof toEffect>[0];

function stackProgram(module: unknown): StackProgram | undefined {
  const program: unknown =
    typeof module === "object" && module !== null ? Reflect.get(module, "default") : undefined;
  return Effect.isEffect(program) ? (program as StackProgram) : undefined;
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
        toEffect(Effect.provideService(program, Stage, verificationSettings.prefix), {
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
  return inventoryOf(shape);
});

export { applyVerificationEnvironment, compileStack };
export type { StackInventory };
