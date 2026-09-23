import { useAtomValue } from "@effect/atom-react";
import { requestAtom, type RequestResult } from "@repo/ui";
import { createClientOnlyFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { ErDiagramUnreadable } from "./er-diagram-unreadable.ts";
import { layoutErGraph, type ErGraph } from "./er-graph.ts";

type Diagram = Readonly<{ graph: ErGraph; kind: "er" }> | Readonly<{ kind: "svg"; svg: string }>;

const ErEntities = Schema.Array(
  Schema.Struct({
    attributes: Schema.Array(
      Schema.Struct({
        comment: Schema.String,
        keys: Schema.Array(Schema.String),
        name: Schema.String,
        type: Schema.String,
      }),
    ),
    id: Schema.String,
    label: Schema.String,
  }),
);

const ErRelationships = Schema.Array(
  Schema.Struct({
    entityA: Schema.String,
    entityB: Schema.String,
    relSpec: Schema.Struct({ cardA: Schema.String, cardB: Schema.String, relType: Schema.String }),
    roleA: Schema.String,
  }),
);

const callDatabase = (
  database: object,
  method: string,
): Effect.Effect<unknown, ErDiagramUnreadable> => {
  const read: unknown = Reflect.get(database, method);
  return typeof read === "function"
    ? Effect.sync(() => Reflect.apply(read, database, []))
    : Effect.fail(new ErDiagramUnreadable({ reason: `the mermaid ER database has no ${method}` }));
};

const erGraphOf = Effect.fn("erGraphOf")(function* erGraphOf(database: object) {
  const entityMap = yield* callDatabase(database, "getEntities");
  if (!(entityMap instanceof Map)) {
    return yield* new ErDiagramUnreadable({
      reason: "the mermaid ER database returned entities that are not a map",
    });
  }
  const [entities, relationships] = yield* Effect.all(
    [
      Schema.decodeUnknownEffect(ErEntities)(
        Array.from(entityMap.values(), (entity: unknown) => entity),
      ),
      callDatabase(database, "getRelationships").pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(ErRelationships)),
      ),
    ],
    { concurrency: "unbounded" },
  );
  return yield* layoutErGraph(entities, relationships);
});

const renderChart = createClientOnlyFn(
  ({ chart, dark, id }: Readonly<{ chart: string; dark: boolean; id: string }>): Promise<Diagram> =>
    Effect.runPromise(
      Effect.gen(function* renderMermaid() {
        const { default: mermaid } = yield* Effect.promise(() => import("mermaid"));
        mermaid.initialize({
          fontFamily: "inherit",
          securityLevel: "strict",
          startOnLoad: false,
          theme: dark ? "dark" : "default",
        });
        const parsed = yield* Effect.promise(() => mermaid.mermaidAPI.getDiagramFromText(chart));
        if (parsed.type === "er") {
          return { graph: yield* erGraphOf(parsed.db), kind: "er" } as const;
        }
        const { svg } = yield* Effect.promise(() => mermaid.render(id, chart));
        return { kind: "svg", svg } as const;
      }),
    ),
);

const diagramAtom = Atom.family((diagram: Readonly<{ chart: string; dark: boolean; id: string }>) =>
  requestAtom(() => renderChart(diagram)),
);

function useDiagram(chart: string, dark: boolean, id: string): RequestResult<Diagram> {
  return useAtomValue(diagramAtom({ chart, dark, id }));
}

export { useDiagram };
