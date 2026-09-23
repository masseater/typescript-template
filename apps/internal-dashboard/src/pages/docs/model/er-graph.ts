import { Effect } from "effect";
import ELK from "elkjs/lib/elk.bundled.js";

import { ErDiagramUnreadable } from "./er-diagram-unreadable.ts";

const cardinalities = ["ONLY_ONE", "ZERO_OR_ONE", "ONE_OR_MORE", "ZERO_OR_MORE"] as const;
type Cardinality = (typeof cardinalities)[number];

type ErAttribute = Readonly<{
  comment: string;
  keys: readonly string[];
  name: string;
  type: string;
}>;

type ErEntity = Readonly<{ attributes: readonly ErAttribute[]; id: string; label: string }>;

type ErRelationship = Readonly<{
  entityA: string;
  entityB: string;
  relSpec: Readonly<{ cardA: string; cardB: string; relType: string }>;
  roleA: string;
}>;

type ErTable = Readonly<{
  attributes: readonly ErAttribute[];
  height: number;
  id: string;
  label: string;
  width: number;
  x: number;
  y: number;
}>;

type ErLink = Readonly<{
  dashed: boolean;
  id: string;
  label: string;
  source: string;
  sourceEnd: Cardinality;
  target: string;
  targetEnd: Cardinality;
}>;

type ErGraph = Readonly<{ links: readonly ErLink[]; tables: readonly ErTable[] }>;

const FRAME_BORDER = 2;
const HEADER_HEIGHT = 32;
const ROW_HEIGHT = 24;
const CHARACTER_WIDTH = 7.2;
const ROW_PADDING = 24;
const COLUMN_GAP = 16;
const COLUMN_COUNT = 4;

const isCardinality = (value: string): value is Cardinality =>
  cardinalities.some((cardinality) => cardinality === value);

const cardinality = (value: string): Effect.Effect<Cardinality, ErDiagramUnreadable> =>
  isCardinality(value)
    ? Effect.succeed(value)
    : Effect.fail(new ErDiagramUnreadable({ reason: `unknown ER cardinality: ${value}` }));

const longest = (texts: readonly string[]): number =>
  Math.max(0, ...texts.map((text) => text.length));

const tableWidth = (entity: ErEntity): number => {
  const rowCharacters = [
    longest(entity.attributes.map((attribute) => attribute.type)),
    longest(entity.attributes.map((attribute) => attribute.name)),
    longest(entity.attributes.map((attribute) => attribute.keys.join(","))),
    longest(entity.attributes.map((attribute) => attribute.comment)),
  ].reduce((total, width) => total + width, 0);
  const rowWidth = rowCharacters * CHARACTER_WIDTH + (COLUMN_COUNT - 1) * COLUMN_GAP;
  return (
    Math.ceil(Math.max(rowWidth, entity.label.length * CHARACTER_WIDTH)) +
    ROW_PADDING +
    FRAME_BORDER
  );
};

const tableHeight = (entity: ErEntity): number =>
  HEADER_HEIGHT + entity.attributes.length * ROW_HEIGHT + FRAME_BORDER;

const elk = new ELK();

const layoutErGraph = Effect.fn("layoutErGraph")(function* layoutErGraph(
  entities: readonly ErEntity[],
  relationships: readonly ErRelationship[],
) {
  const links = yield* Effect.forEach(
    relationships,
    (relationship, index) =>
      Effect.all({
        sourceEnd: cardinality(relationship.relSpec.cardB),
        targetEnd: cardinality(relationship.relSpec.cardA),
      }).pipe(
        Effect.map((ends): ErLink => ({
          dashed: relationship.relSpec.relType === "NON_IDENTIFYING",
          id: `link-${index}`,
          label: relationship.roleA,
          source: relationship.entityA,
          target: relationship.entityB,
          ...ends,
        })),
      ),
    { concurrency: "unbounded" },
  );
  const laidOut = yield* Effect.tryPromise({
    catch: (cause) =>
      new ErDiagramUnreadable({ reason: `ELK could not lay out: ${String(cause)}` }),
    try: () =>
      elk.layout({
        children: entities.map((entity) => ({
          height: tableHeight(entity),
          id: entity.id,
          width: tableWidth(entity),
        })),
        edges: links.map((link) => ({
          id: link.id,
          sources: [link.source],
          targets: [link.target],
        })),
        id: "root",
        layoutOptions: {
          "elk.algorithm": "layered",
          "elk.direction": "DOWN",
          "elk.layered.spacing.nodeNodeBetweenLayers": "120",
          "elk.spacing.componentComponent": "64",
          "elk.spacing.nodeNode": "48",
        },
      }),
  });
  const tables = yield* Effect.forEach(
    entities,
    (entity) => {
      const placed = laidOut.children?.find((child) => child.id === entity.id);
      return placed?.x === undefined || placed.y === undefined
        ? Effect.fail(
            new ErDiagramUnreadable({ reason: `ELK placed no position for ${entity.id}` }),
          )
        : Effect.succeed<ErTable>({
            attributes: entity.attributes,
            height: tableHeight(entity),
            id: entity.id,
            label: entity.label,
            width: tableWidth(entity),
            x: placed.x,
            y: placed.y,
          });
    },
    { concurrency: "unbounded" },
  );
  return { links, tables } satisfies ErGraph;
});

export { layoutErGraph };
export type { Cardinality, ErGraph, ErLink, ErTable };
