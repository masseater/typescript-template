import { Stage, inMemoryState } from "alchemy";
import { providers } from "alchemy/Cloudflare";
import { isApplyExpr, isExpr, isPropExpr, isRefExpr } from "alchemy/Output";
import { toEffect } from "alchemy/Test/Core";
import { Effect, Predicate, References, Result, Schema } from "effect";

import { repositoryRoot } from "./artifacts.ts";
import { stackName } from "./stacks.ts";
import { verificationEnvironment, verificationSettings } from "./verification-fixture.ts";

import type { StackName } from "./stacks.ts";

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
  const fields = Result.try(() => JSON.stringify(cause));
  return Result.isSuccess(fields) && fields.success !== "{}" ? fields.success : String(cause);
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
const CALLABLE_KEYS: ReadonlySet<string> = new Set(["length", "name", "prototype"]);

function traversable(value: unknown): value is object {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

function referencePath(value: unknown): string | undefined {
  if (isRefExpr(value)) {
    const stage = value.stage === undefined ? "" : `@${value.stage}`;
    return `${value.stack ?? "<self>"}${stage}.${value.resourceId}`;
  }
  if (isPropExpr(value)) {
    const base = referencePath(value.expr);
    return base === undefined ? undefined : `${base}.${String(value.identifier)}`;
  }
  return undefined;
}

function expressionValue(value: unknown): string {
  return referencePath(value) ?? `<unresolved ${isExpr(value) ? value.kind : typeof value}>`;
}

function opaqueValue(value: unknown): string | undefined {
  if (isExpr(value)) {
    return expressionValue(value);
  }
  if (typeof value === "function") {
    return "<function>";
  }
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) ?? Object.prototype) !== Object.prototype
  ) {
    return `<${value.constructor.name}>`;
  }
  return undefined;
}

function declaredValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(repositoryRoot, "").replace(DIGEST_SEGMENT, "/<digest>/");
  }
  const opaque = opaqueValue(value);
  if (opaque !== undefined) {
    return opaque;
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
    process.env[name] = value;
  }
}

const BINDING_IDENTITY_KEYS: ReadonlySet<string> = new Set(["name", "type"]);

const fixtureVariableByValue: ReadonlyMap<string, string> = new Map(
  Object.entries(verificationEnvironment).map(([name, value]) => [value, `$${name}`]),
);

function secretSource(text: unknown): string {
  return (typeof text === "string" ? fixtureVariableByValue.get(text) : undefined) ?? "<unknown>";
}

function bindingText(declared: unknown): string {
  if (Array.isArray(declared)) {
    return declared.map(String).toSorted().join(",");
  }
  return typeof declared === "string" ? declared : JSON.stringify(declared);
}

function bindingDetail(type: string, key: string, value: unknown): string {
  const text =
    type === "secret_text" && key === "text"
      ? secretSource(value)
      : bindingText(declaredValue(value));
  return `${key}=${text}`;
}

function deferredValue(binding: unknown): string {
  return isExpr(binding) && isApplyExpr(binding)
    ? expressionValue(binding.expr)
    : expressionValue(binding);
}

function describeBinding(entry: typeof BindingEntry.Type): string {
  const [binding] = entry.data.bindings;
  if (isExpr(binding)) {
    return `${entry.sid}:deferred:${deferredValue(binding)}`;
  }
  if (!traversable(binding)) {
    return `${entry.sid}:<${typeof binding}>`;
  }
  const type = String(Reflect.get(binding, "type"));
  return [
    entry.sid,
    type,
    ...Object.entries(binding)
      .filter(
        ([key, value]: readonly [string, unknown]) =>
          value !== undefined && !BINDING_IDENTITY_KEYS.has(key),
      )
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, value]: readonly [string, unknown]) => bindingDetail(type, key, value)),
  ].join(":");
}

const SEND_EMAIL = "send_email";

function bindsSendEmail(inventory: StackInventory): boolean {
  return Object.values(inventory.resources).some((resource) =>
    resource.bindings.some((binding) => binding.split(":")[1] === SEND_EMAIL),
  );
}

function declaredOf(props: Readonly<Record<string, unknown>>): unknown {
  return Object.fromEntries(
    Object.entries(props)
      .filter(([property]) => property !== BINDING_PROPERTY)
      .flatMap(([property, value]) => {
        const declared = declaredValue(value);
        return declared === undefined ? [] : [[property, declared] as const];
      }),
  );
}

function collectReferences(value: unknown, seen: Set<unknown>, found: Set<string>): void {
  if (!traversable(value) || seen.has(value)) {
    return;
  }
  seen.add(value);
  if (isRefExpr(value) && value.stack !== undefined) {
    found.add(value.stack);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "string" && !CALLABLE_KEYS.has(key)) {
      collectReferences(Reflect.get(value, key), seen, found);
    }
  }
}

function referencedStacks(shape: typeof CompiledShape.Type): readonly string[] {
  const found = new Set<string>();
  collectReferences([shape.bindings, shape.resources], new Set(), found);
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
  const program: unknown = Predicate.isObject(module) ? Reflect.get(module, "default") : undefined;
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

export { applyVerificationEnvironment, bindsSendEmail, compileStack, describeCause };
export type { StackInventory };
