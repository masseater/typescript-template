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
  if (cause instanceof Error && cause.message !== "") {
    return String(cause);
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

const BINDING_PROPERTY = "env";
const DIGEST_SEGMENT = /\/[0-9a-f]{64}\//u;
const REFERENCE_KIND = "RefExpr";
const CALLABLE_KEYS: ReadonlySet<string> = new Set(["length", "name", "prototype"]);

function traversable(value: unknown): value is object {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

function referencePath(value: unknown): string | undefined {
  if (!traversable(value)) {
    return undefined;
  }
  const kind: unknown = Reflect.get(value, "kind");
  const inner: unknown = Reflect.get(value, "expr");
  if (kind === REFERENCE_KIND) {
    return `${String(Reflect.get(value, "stack"))}.${String(Reflect.get(value, "resourceId"))}`;
  }
  if (kind === "PropExpr") {
    const base = referencePath(inner);
    return base === undefined ? undefined : `${base}.${String(Reflect.get(value, "identifier"))}`;
  }
  return kind === "ApplyExpr" ? referencePath(inner) : undefined;
}

function declaredValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(repositoryRoot, "").replace(DIGEST_SEGMENT, "/<digest>/");
  }
  const reference = referencePath(value);
  if (reference !== undefined) {
    return reference;
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => declaredValue(item));
  }
  if (typeof value !== "object" || value === null) {
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

const BINDING_IDENTITY_KEYS: ReadonlySet<string> = new Set(["name", "type"]);

function bindingField(type: string, key: string, value: unknown): boolean {
  return (
    value !== undefined &&
    !BINDING_IDENTITY_KEYS.has(key) &&
    !(type === "secret_text" && key === "text")
  );
}

function bindingText(declared: unknown): string {
  if (Array.isArray(declared)) {
    return declared.map(String).toSorted().join(",");
  }
  return typeof declared === "string" ? declared : JSON.stringify(declared);
}

function bindingDetail(key: string, value: unknown): string {
  return `${key}=${bindingText(declaredValue(value))}`;
}

function describeBinding(entry: typeof BindingEntry.Type): string {
  const [binding] = entry.data.bindings;
  if (!traversable(binding) || typeof binding === "function") {
    return `${entry.sid}:deferred:${referencePath(binding) ?? "unresolved"}`;
  }
  const type = String(Reflect.get(binding, "type"));
  return [
    entry.sid,
    type,
    ...Object.entries(binding)
      .filter(([key, value]: readonly [string, unknown]) => bindingField(type, key, value))
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, value]: readonly [string, unknown]) => bindingDetail(key, value)),
  ].join(":");
}

function declaredOf(props: Readonly<Record<string, unknown>>): unknown {
  return Object.fromEntries(
    Object.entries(props)
      .filter(([property]) => property !== BINDING_PROPERTY)
      .map(([property, value]: readonly [string, unknown]) => [property, declaredValue(value)]),
  );
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

export { applyVerificationEnvironment, compileStack, describeCause };
export type { StackInventory };
