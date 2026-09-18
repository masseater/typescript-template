import { Effect, References, Schema } from "effect";
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
  readonly dependencies: readonly string[];
  readonly name: string;
  readonly resources: Readonly<Record<string, ResourceInventory>>;
}

class InventoryFailure extends Schema.TaggedError<InventoryFailure>()("InventoryFailure", {
  code: Schema.Literals(["stack_module_invalid", "stack_compilation_failed"]),
  detail: Schema.String,
  stack: Schema.String,
}) {}

function describeCause(cause: unknown): string {
  if (typeof cause === "string") {
    return cause;
  }
  const fields = JSON.stringify(cause);
  return fields === "{}" ? String(cause) : fields;
}

function inventoryFailure(
  code: typeof InventoryFailure.fields.code.Type,
  stack: string,
  cause: unknown,
): InventoryFailure {
  return new InventoryFailure({ code, detail: describeCause(cause), stack });
}

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

const bindingDetails = [
  "className",
  "destinationAddress",
  "allowedDestinationAddresses",
  "allowedSenderAddresses",
] as const;

const isBindingDetail = Schema.is(Schema.Union([Schema.String, Schema.Array(Schema.String)]));

function bindingDetail(value: unknown): readonly string[] {
  if (!isBindingDetail(value)) {
    return [];
  }
  return [typeof value === "string" ? value : [...value].toSorted().join(",")];
}

function describeBinding(entry: typeof BindingEntry.Type): string {
  const [binding] = entry.data.bindings;
  if (typeof binding !== "object" || binding === null) {
    return `${entry.sid}:deferred`;
  }
  const type = String(Reflect.get(binding, "type"));
  return [
    entry.sid,
    type,
    ...bindingDetails.flatMap((key) => bindingDetail(Reflect.get(binding, key))),
    ...(type === "plain_text" ? bindingDetail(Reflect.get(binding, "text")) : []),
  ].join(":");
}

function declaredOf(props: Readonly<Record<string, unknown>>): unknown {
  return Object.fromEntries(
    declaredProperties.flatMap((property) =>
      Object.hasOwn(props, property) ? [[property, declaredValue(props[property])]] : [],
    ),
  );
}

const REFERENCE_KIND = "RefExpr";
const CALLABLE_KEYS: ReadonlySet<string> = new Set(["length", "name", "prototype"]);

function traversable(value: unknown): value is object {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

function collectReferences(value: unknown, seen: Set<unknown>, found: Set<string>): void {
  if (!traversable(value) || seen.has(value)) {
    return;
  }
  seen.add(value);
  const referenced: unknown = Reflect.get(value, "stack");
  if (Reflect.get(value, "kind") === REFERENCE_KIND && typeof referenced === "string") {
    found.add(referenced);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "string" && !CALLABLE_KEYS.has(key)) {
      collectReferences(Reflect.get(value, key), seen, found);
    }
  }
}

function referencedStacks(shape: typeof CompiledShape.Type): readonly string[] {
  const found = new Set<string>();
  collectReferences(shape.bindings, new Set(), found);
  return [...found].filter((referenced) => referenced !== shape.name).toSorted();
}

function inventoryOf(shape: typeof CompiledShape.Type): StackInventory {
  return {
    dependencies: referencedStacks(shape),
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
  const module: unknown = yield* Effect.tryPromise({
    catch: (cause) => inventoryFailure("stack_module_invalid", stack, cause),
    try: async (): Promise<unknown> => import(`./${stack}.ts`),
  });
  const program = stackProgram(module);
  if (program === undefined) {
    return yield* Effect.fail(
      inventoryFailure("stack_module_invalid", stack, "default export is not an Effect"),
    );
  }
  const compiled: unknown = yield* Effect.tryPromise({
    catch: (cause) => inventoryFailure("stack_compilation_failed", stack, cause),
    try: async () =>
      Effect.runPromise(
        toEffect(Effect.provideService(program, Stage, verificationSettings.prefix), {
          providers: providers(),
          state: inMemoryState(),
        }).pipe(Effect.provideService(References.MinimumLogLevel, "Warn")),
      ),
  });
  const shape = yield* Schema.decodeUnknownEffect(CompiledShape)(compiled).pipe(
    Effect.mapError((cause) => inventoryFailure("stack_compilation_failed", stack, cause)),
  );
  if (shape.name !== stackName(stack)) {
    return yield* Effect.fail(
      inventoryFailure("stack_module_invalid", stack, `stack is named ${shape.name}`),
    );
  }
  return inventoryOf(shape);
});

export { applyVerificationEnvironment, compileStack };
export type { StackInventory };
