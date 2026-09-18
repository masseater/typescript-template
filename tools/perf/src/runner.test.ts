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

const AttributeValue = Schema.Struct({
  doubleValue: Schema.optionalKey(Schema.Number),
  stringValue: Schema.optionalKey(Schema.String),
});
const Attribute = Schema.Struct({ key: Schema.String, value: AttributeValue });
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
      server.listen({
        onUnhandledRequest: (request, print) => {
          if (new URL(request.url).pathname !== "/v1/traces") {
            print.error();
          }
        },
      });
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

function attributeOf(span: ExportedSpan | undefined, key: string): number | string | undefined {
  const value = span?.attributes.find((attribute) => attribute.key === key)?.value;
  return value?.doubleValue ?? value?.stringValue;
}

const grandchild = `${process.execPath} -e 'process.exitCode = ${String(GRANDCHILD_EXIT)}'; true`;
const nestedCommand = [
  process.execPath,
  "-e",
  `require("node:child_process").spawnSync("/bin/sh", ["-c", ${JSON.stringify(grandchild)}]); process.exitCode = ${String(CHILD_EXIT)}`,
];

it.effect(
  "exports the process tree of the command it ran",
  () =>
    Effect.gen(function* program() {
      const bodies = yield* receiver(true);
      const exitCode = yield* traceCommand(nestedCommand, { endpoint: ENDPOINT, environment: {} });
      const [root, ...processes] = yield* exportedSpans(bodies.at(-1));
      const child = processes.find((span) => span.parentSpanId === root?.spanId);
      const descendant = processes.find((span) => span.parentSpanId === child?.spanId);
      assert.strictEqual(exitCode, CHILD_EXIT);
      assert.strictEqual(root?.status.code, STATUS_ERROR);
      assert.strictEqual(processes.length, TRACED_PROCESSES);
      assert.deepStrictEqual(
        [child, descendant].map((span) => [
          attributeOf(span, "process.exit.code"),
          attributeOf(span, "perf.parent_source"),
        ]),
        [
          [CHILD_EXIT, "process"],
          [GRANDCHILD_EXIT, "environment"],
        ],
      );
      assert.deepStrictEqual(
        [attributeOf(root, "perf.process.orphaned"), attributeOf(root, "perf.process.unreadable")],
        [0, 0],
      );
    }),
  { timeout: 60_000 },
);

it.effect("runs the command untraced when the receiver is unreachable", () =>
  Effect.gen(function* program() {
    const bodies = yield* receiver(false);
    const exitCode = yield* traceCommand(
      [process.execPath, "-e", `process.exitCode = ${String(UNREACHABLE_EXIT)}`],
      { endpoint: ENDPOINT, environment: {} },
    );
    assert.strictEqual(exitCode, UNREACHABLE_EXIT);
    assert.deepStrictEqual(bodies, [JSON.stringify({ resourceSpans: [] })]);
  }),
);
