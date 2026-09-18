import { Effect, Schema } from "effect";
import { HttpResponse, http } from "msw";
import { assert, it } from "@effect/vitest";
import type { Scope } from "effect";
import { setupServer } from "msw/node";
import { traceCommand } from "./runner.ts";

const ENDPOINT = "http://otlp.test";
const CHILD_EXIT = 5;
const GRANDCHILD_EXIT = 3;
const UNREACHABLE_EXIT = 7;
const STATUS_ERROR = 2;
const TRACED_PROCESSES = 2;

const ExitCode = Schema.Struct({ doubleValue: Schema.optionalKey(Schema.Number) });
const Attribute = Schema.Struct({ key: Schema.String, value: ExitCode });
const Span = Schema.Struct({
  attributes: Schema.Array(Attribute),
  name: Schema.String,
  parentSpanId: Schema.String,
  spanId: Schema.String,
  status: Schema.Struct({ code: Schema.Number }),
});
const ScopeSpans = Schema.Struct({ spans: Schema.Array(Span) });
const ResourceSpans = Schema.Struct({ scopeSpans: Schema.Array(ScopeSpans) });
const Exported = Schema.fromJsonString(
  Schema.Struct({ resourceSpans: Schema.Array(ResourceSpans) }),
);
type ExportedSpan = typeof Span.Type;

function receiver(reachable: boolean): Effect.Effect<readonly string[], never, Scope.Scope> {
  const bodies: string[] = [];
  return Effect.acquireRelease(
    Effect.sync(() => {
      const server = setupServer(
        http.post(`${ENDPOINT}/v1/traces`, async ({ request }) => {
          bodies.push(await request.text());
          return reachable ? HttpResponse.json({}) : HttpResponse.error();
        }),
      );
      server.listen({ onUnhandledRequest: "error" });
      return server;
    }),
    (server) =>
      Effect.sync(() => {
        server.close();
      }),
  ).pipe(Effect.as(bodies));
}

function exportedSpans(
  body: string | undefined,
): Effect.Effect<readonly ExportedSpan[], Schema.SchemaError> {
  return Schema.decodeUnknownEffect(Exported)(body).pipe(
    Effect.map((exported) =>
      exported.resourceSpans.flatMap((resource) =>
        resource.scopeSpans.flatMap((scope) => scope.spans),
      ),
    ),
  );
}

function exitCodeOf(span: ExportedSpan | undefined): number | undefined {
  return span?.attributes.find(({ key }) => key === "process.exit.code")?.value.doubleValue;
}

const nestedCommand = [
  process.execPath,
  "-e",
  `require("node:child_process").spawnSync(process.execPath, ["-e", "process.exitCode = ${GRANDCHILD_EXIT}"]); process.exitCode = ${CHILD_EXIT}`,
];

it.effect("exports the process tree of the command it ran", () =>
  Effect.gen(function* program() {
    const bodies = yield* receiver(true);
    const exitCode = yield* traceCommand(nestedCommand, { endpoint: ENDPOINT, environment: {} });
    const [root, ...processes] = yield* exportedSpans(bodies.at(-1));
    const child = processes.find((span) => span.parentSpanId === root?.spanId);
    const grandchild = processes.find((span) => span.parentSpanId === child?.spanId);
    assert.strictEqual(exitCode, CHILD_EXIT);
    assert.strictEqual(root?.status.code, STATUS_ERROR);
    assert.strictEqual(processes.length, TRACED_PROCESSES);
    assert.deepStrictEqual(
      [exitCodeOf(child), exitCodeOf(grandchild)],
      [CHILD_EXIT, GRANDCHILD_EXIT],
    );
  }),
);

it.effect("runs the command untraced when the receiver is unreachable", () =>
  Effect.gen(function* program() {
    const bodies = yield* receiver(false);
    const exitCode = yield* traceCommand(
      [process.execPath, "-e", `process.exitCode = ${UNREACHABLE_EXIT}`],
      { endpoint: ENDPOINT, environment: {} },
    );
    assert.strictEqual(exitCode, UNREACHABLE_EXIT);
    assert.deepStrictEqual(bodies, [JSON.stringify({ resourceSpans: [] })]);
  }),
);
