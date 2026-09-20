import { Effect, Schema } from "effect";

import { apiRoot } from "./http.ts";

import type { AnyElysia } from "elysia";

interface ReferenceCoverage {
  readonly documented: readonly string[];
  readonly served: readonly string[];
  readonly status: number;
}

const Document = Schema.Struct({
  paths: Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown)),
});
const Route = Schema.Struct({
  hooks: Schema.Struct({
    detail: Schema.optionalKey(Schema.Struct({ hide: Schema.optionalKey(Schema.Boolean) })),
  }),
  method: Schema.String,
  path: Schema.String,
});
const readDocument = Schema.decodeUnknownEffect(Document);
const readRoutes = Schema.decodeUnknownEffect(Schema.Array(Route));
const referenceOrigin = "http://localhost";

function documentedOperations(document: typeof Document.Type): readonly string[] {
  return Object.entries(document.paths)
    .flatMap(([path, methods]) =>
      Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
    )
    .toSorted((left, right) => left.localeCompare(right));
}

function servedOperations(app: AnyElysia): Effect.Effect<readonly string[], Schema.SchemaError> {
  return readRoutes(app.routes).pipe(
    Effect.map((routes) =>
      routes
        .filter((route) => route.hooks.detail?.hide !== true)
        .map((route) => `${route.method} ${route.path}`)
        .toSorted((left, right) => left.localeCompare(right)),
    ),
  );
}

const referenceCoverage = Effect.fn("referenceCoverage")(function* referenceCoverage(
  app: AnyElysia,
  init?: RequestInit,
) {
  const reply = yield* Effect.promise(async () =>
    app.fetch(new Request(`${referenceOrigin}${apiRoot}/docs/json`, init)),
  );
  const served = yield* servedOperations(app);
  if (!reply.ok) {
    return { documented: [], served, status: reply.status } satisfies ReferenceCoverage;
  }
  const document = yield* readDocument(yield* Effect.promise(async () => reply.json()));
  return {
    documented: documentedOperations(document),
    served,
    status: reply.status,
  } satisfies ReferenceCoverage;
});

export { referenceCoverage };
export type { ReferenceCoverage };
