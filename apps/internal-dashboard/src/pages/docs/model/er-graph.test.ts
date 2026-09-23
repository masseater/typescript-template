import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { ErDiagramUnreadable } from "./er-diagram-unreadable.ts";
import { layoutErGraph } from "./er-graph.ts";

type ErEntity = Parameters<typeof layoutErGraph>[0][number];
type ErRelationship = Parameters<typeof layoutErGraph>[1][number];

const column = (name: string, keys: readonly string[] = []): ErEntity["attributes"][number] => ({
  comment: "",
  keys,
  name,
  type: "text",
});

const entities: readonly ErEntity[] = [
  {
    attributes: [column("id", ["PK"]), column("email", ["UK"])],
    id: "entity-user-0",
    label: "user",
  },
  {
    attributes: [column("id", ["PK"]), column("user_id", ["FK"])],
    id: "entity-session-1",
    label: "session",
  },
  { attributes: [], id: "entity-audit-2", label: "audit" },
];

const relationships: readonly ErRelationship[] = [
  {
    entityA: "entity-user-0",
    entityB: "entity-session-1",
    relSpec: { cardA: "ZERO_OR_MORE", cardB: "ONLY_ONE", relType: "IDENTIFYING" },
    roleA: "user_id",
  },
  {
    entityA: "entity-user-0",
    entityB: "entity-audit-2",
    relSpec: { cardA: "ONE_OR_MORE", cardB: "ZERO_OR_ONE", relType: "NON_IDENTIFYING" },
    roleA: "",
  },
];

const overlaps = (
  left: Readonly<{ height: number; width: number; x: number; y: number }>,
  right: Readonly<{ height: number; width: number; x: number; y: number }>,
): boolean =>
  left.x < right.x + right.width &&
  right.x < left.x + left.width &&
  left.y < right.y + right.height &&
  right.y < left.y + left.height;

describe("layoutErGraph", () => {
  const it = test.extend("graph", () => Effect.runPromise(layoutErGraph(entities, relationships)));

  it("puts the left mark of a Mermaid relationship on its first entity and the right mark on its second", ({
    graph,
  }) => {
    expect(graph.links).toStrictEqual([
      {
        dashed: false,
        id: "link-0",
        label: "user_id",
        source: "entity-user-0",
        sourceEnd: "ONLY_ONE",
        target: "entity-session-1",
        targetEnd: "ZERO_OR_MORE",
      },
      {
        dashed: true,
        id: "link-1",
        label: "",
        source: "entity-user-0",
        sourceEnd: "ZERO_OR_ONE",
        target: "entity-audit-2",
        targetEnd: "ONE_OR_MORE",
      },
    ]);
  });

  it("sizes each table to its header and rows and places no two tables on top of each other", ({
    graph,
  }) => {
    expect(graph.tables.map((table) => [table.label, table.height])).toStrictEqual([
      ["user", 82],
      ["session", 82],
      ["audit", 34],
    ]);
    expect(
      graph.tables.flatMap((table, index) =>
        graph.tables.slice(index + 1).filter((other) => overlaps(table, other)),
      ),
    ).toStrictEqual([]);
  });

  it("lays referenced tables out before the tables that reference them", ({ graph }) => {
    const [user, session] = graph.tables;
    expect(user === undefined || session === undefined ? undefined : user.y < session.y).toBe(true);
  });
});

describe("layoutErGraph with a cardinality Mermaid does not define", () => {
  const it = test.extend("failure", () =>
    layoutErGraph(entities, [
      {
        entityA: "entity-user-0",
        entityB: "entity-session-1",
        relSpec: { cardA: "MANY_MANY", cardB: "ONLY_ONE", relType: "IDENTIFYING" },
        roleA: "",
      },
    ]).pipe(Effect.flip, Effect.runPromise));

  it("fails instead of drawing a mark it does not know", ({ failure }) => {
    expect(failure).toStrictEqual(
      new ErDiagramUnreadable({ reason: "unknown ER cardinality: MANY_MANY" }),
    );
  });
});
