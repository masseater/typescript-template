import { DiagramCrowded } from "./diagram-crowded.ts";
import {
  center,
  distanceToRoute,
  formatPoints,
  inflate,
  segmentsOf,
  withoutSpaces,
} from "./diagram-geometry.ts";
import {
  boxesOverlap,
  collinearOverlap,
  markZones,
  overlapsOf,
  segmentEntersBox,
  shareAnEnd,
  type Overlap,
} from "./diagram-overlaps.ts";
import { routeAround, type Direction } from "./route-around.ts";

import type { Element } from "hast";
import type { Box, DiagramGeometry, Label, Point, Route } from "./diagram-geometry.ts";

const LABEL_GAP = 4;
const LABEL_FRACTIONS = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9];
const ASIDE_DISTANCES = [LABEL_GAP, 16, 32];

const directionBetween = (from: Point, to: Point): Direction => ({
  x: Math.sign(Math.round(to.x - from.x)) as Direction["x"],
  y: Math.sign(Math.round(to.y - from.y)) as Direction["y"],
});

const crossesShapes = (geometry: DiagramGeometry, route: Route): boolean =>
  geometry.shapes.some(
    (shape) =>
      shape.id !== route.from &&
      shape.id !== route.to &&
      segmentsOf(route.points).some((segment) => segmentEntersBox(segment, shape.box)),
  );

const rerouteThroughShapes = (geometry: DiagramGeometry): readonly Route[] =>
  geometry.routes.filter((route) => {
    if (!crossesShapes(geometry, route)) {
      return false;
    }
    const [start, second] = route.points;
    const [end, beforeEnd] = route.points.toReversed();
    if (
      start === undefined ||
      second === undefined ||
      end === undefined ||
      beforeEnd === undefined
    ) {
      throw new Error(`the route ${route.from}->${route.to} has fewer than two points`);
    }
    const shapeOf = (id: string): Box => {
      const shape = geometry.shapes.find((candidate) => candidate.id === id);
      if (shape === undefined) {
        throw new Error(`the route ${route.from}->${route.to} ends at ${id}, which is not drawn`);
      }
      return shape.box;
    };
    route.points = routeAround({
      arrival: directionBetween(beforeEnd, end),
      crossable: geometry.routes.flatMap((other) =>
        other !== route && !shareAnEnd(other, route) ? segmentsOf(other.points) : [],
      ),
      departure: directionBetween(start, second),
      end,
      endShape: shapeOf(route.to),
      obstacles: geometry.shapes.map((shape) => shape.box),
      start,
      startShape: shapeOf(route.from),
    });
    route.element.properties["points"] = formatPoints(route.points);
    return true;
  });

const boxAt = (middle: Point, width: number, height: number): Box => ({
  height,
  width,
  x: middle.x - width / 2,
  y: middle.y - height / 2,
});

const candidatesFor = (label: Label): readonly Readonly<{ box: Box; onLine: boolean }>[] =>
  segmentsOf(label.route.points)
    .toSorted(
      ([leftStart, leftEnd], [rightStart, rightEnd]) =>
        Math.hypot(rightEnd.x - rightStart.x, rightEnd.y - rightStart.y) -
        Math.hypot(leftEnd.x - leftStart.x, leftEnd.y - leftStart.y),
    )
    .flatMap(([start, end]) =>
      LABEL_FRACTIONS.flatMap((fraction) => {
        const point = {
          x: start.x + (end.x - start.x) * fraction,
          y: start.y + (end.y - start.y) * fraction,
        };
        const { height, width } = label.box;
        const vertical = Math.abs(end.x - start.x) < 0.5;
        const half = vertical ? width / 2 : height / 2;
        return [
          { box: boxAt(point, width, height), onLine: true },
          ...ASIDE_DISTANCES.flatMap((distance) =>
            [-1, 1].map((side) => ({
              box: boxAt(
                vertical
                  ? { x: point.x + side * (half + distance), y: point.y }
                  : { x: point.x, y: point.y + side * (half + distance) },
                width,
                height,
              ),
              onLine: false,
            })),
          ),
        ];
      }),
    )
    .toSorted((left, right) => Number(left.onLine === false) - Number(right.onLine === false));

const closestToItsOwnRoute = (geometry: DiagramGeometry, label: Label, box: Box): boolean => {
  const middle = center(box);
  const words = withoutSpaces(label.route.label ?? "");
  const ownDistance = distanceToRoute(middle, label.route);
  return !geometry.routes.some(
    (route) =>
      route !== label.route &&
      withoutSpaces(route.label ?? "") === words &&
      distanceToRoute(middle, route) <= ownDistance,
  );
};

const fits = (
  geometry: DiagramGeometry,
  label: Label,
  box: Box,
  onLine: boolean,
  placed: readonly Box[],
): boolean =>
  closestToItsOwnRoute(geometry, label, box) &&
  !geometry.shapes.some((shape) => boxesOverlap(inflate(shape.box, LABEL_GAP), box)) &&
  !placed.some((other) => boxesOverlap(inflate(other, LABEL_GAP), box)) &&
  !geometry.routes.some(
    (route) =>
      markZones(route).some((zone) => boxesOverlap(zone, box)) ||
      ((route !== label.route || !onLine) &&
        segmentsOf(route.points).some((segment) => segmentEntersBox(segment, inflate(box, 1)))),
  );

const shift = (element: Element, property: "x" | "y", delta: number): void => {
  element.properties[property] = String(Number(element.properties[property]) + delta);
};

const moveLabel = (label: Label, box: Box): void => {
  const deltaX = box.x - label.box.x;
  const deltaY = box.y - label.box.y;
  label.frame.properties["x"] = String(box.x);
  label.frame.properties["y"] = String(box.y);
  shift(label.text, "x", deltaX);
  shift(label.text, "y", deltaY);
  for (const line of label.text.children) {
    if (line.type === "element" && line.tagName === "tspan") {
      shift(line, "x", deltaX);
    }
  }
  label.box = box;
};

const LABEL_WIDTH_ALLOWANCE = 1.2;
const LABEL_WIDTH_PADDING = 6;
const LINE_WIDTH = 160;
const LINE_HEIGHT = 14;
const SMALLEST_LABEL_HEIGHT = 28;
const BREAKS_AFTER = new Set([" ", "・", "、", "，", ",", "/", "）", ")"]);
const BREAKS_BEFORE = new Set(["（", "("]);

const codePoints = (text: string): readonly string[] => Array.from(text);

const wrapWords = (words: string, lines: number): readonly string[] => {
  const characters = codePoints(words);
  const target = characters.length / lines;
  const cuts = Array.from({ length: lines - 1 }, (_, index) => {
    const ideal = Math.round(target * (index + 1));
    const nearby = Array.from({ length: Math.ceil(target / 2) }, (_, offset) => [
      ideal - offset,
      ideal + offset,
    ])
      .flat()
      .find(
        (cut) =>
          cut > 0 &&
          cut < characters.length &&
          (BREAKS_AFTER.has(characters[cut - 1] ?? "") || BREAKS_BEFORE.has(characters[cut] ?? "")),
      );
    return nearby ?? ideal;
  });
  const starts = [0, ...cuts];
  return [...cuts, characters.length].flatMap((end, index) => {
    const line = characters.slice(starts[index], end).join("").trim();
    return line.length > 0 ? [line] : [];
  });
};

const MOST_LINES = 3;

type LabelMetrics = Readonly<{ baseHeight: number; baseline: number; characterWidth: number }>;

const metricsOf = (label: Label): LabelMetrics => ({
  baseHeight: Math.max(label.box.height, SMALLEST_LABEL_HEIGHT),
  baseline: Number(label.text.properties["y"]) - center(label.box).y,
  characterWidth: label.box.width / codePoints(label.route.label ?? "").length,
});

const setLines = (label: Label, metrics: LabelMetrics, count: number): void => {
  const lines = count === 1 ? [label.route.label ?? ""] : wrapWords(label.route.label ?? "", count);
  const width =
    Math.max(...lines.map((line) => codePoints(line).length)) *
      metrics.characterWidth *
      LABEL_WIDTH_ALLOWANCE +
    LABEL_WIDTH_PADDING;
  const height = metrics.baseHeight + (lines.length - 1) * LINE_HEIGHT;
  const middle = center(label.box);
  const box = { height, width, x: middle.x - width / 2, y: middle.y - height / 2 };
  label.text.properties["x"] = String(middle.x);
  label.text.properties["y"] = String(
    middle.y + metrics.baseline - ((lines.length - 1) * LINE_HEIGHT) / 2,
  );
  label.text.children = lines.map((line, index) => ({
    children: [{ type: "text", value: line }],
    properties:
      index === 0 ? { x: String(middle.x) } : { dy: String(LINE_HEIGHT), x: String(middle.x) },
    tagName: "tspan",
    type: "element",
  }));
  label.frame.properties["height"] = String(height);
  label.frame.properties["width"] = String(width);
  label.frame.properties["x"] = String(box.x);
  label.frame.properties["y"] = String(box.y);
  label.box = box;
};

const naturalLines = (label: Label): number =>
  Math.min(MOST_LINES, Math.max(1, Math.ceil(label.box.width / LINE_WIDTH)));

const LOOP_REACHES = [28, 56, 84];

const loopsAround = (box: Box): readonly (readonly Point[])[] => {
  const { height, width, x, y } = box;
  const right = x + width;
  const bottom = y + height;
  return LOOP_REACHES.flatMap((reach) => [
    [
      { x: right, y: y + height / 3 },
      { x: right + reach, y: y + height / 3 },
      { x: right + reach, y: y + (height * 2) / 3 },
      { x: right, y: y + (height * 2) / 3 },
    ],
    [
      { x, y: y + height / 3 },
      { x: x - reach, y: y + height / 3 },
      { x: x - reach, y: y + (height * 2) / 3 },
      { x, y: y + (height * 2) / 3 },
    ],
    [
      { x: x + width / 3, y: bottom },
      { x: x + width / 3, y: bottom + reach },
      { x: x + (width * 2) / 3, y: bottom + reach },
      { x: x + (width * 2) / 3, y: bottom },
    ],
    [
      { x: x + width / 3, y },
      { x: x + width / 3, y: y - reach },
      { x: x + (width * 2) / 3, y: y - reach },
      { x: x + (width * 2) / 3, y },
    ],
  ]);
};

const loopIsClear = (
  geometry: DiagramGeometry,
  route: Route,
  points: readonly Point[],
  placed: readonly Box[],
): boolean =>
  segmentsOf(points).every(
    (segment) =>
      !geometry.shapes.some(
        (shape) =>
          shape.id !== route.from && segmentEntersBox(segment, inflate(shape.box, LABEL_GAP)),
      ) &&
      !placed.some((box) => segmentEntersBox(segment, inflate(box, LABEL_GAP))) &&
      !geometry.routes.some(
        (other) =>
          other !== route &&
          segmentsOf(other.points).some((otherSegment) => collinearOverlap(segment, otherSegment)),
      ),
  );

const loopWithRoom = (
  geometry: DiagramGeometry,
  label: Label,
  placed: readonly Box[],
): Box | undefined => {
  const shape = geometry.shapes.find((candidate) => candidate.id === label.route.from);
  if (shape === undefined || label.route.from !== label.route.to) {
    return undefined;
  }
  const original = label.route.points;
  for (const points of loopsAround(shape.box)) {
    if (loopIsClear(geometry, label.route, points, placed)) {
      label.route.points = points;
      const spot = candidatesFor(label).find((candidate) =>
        fits(geometry, label, candidate.box, candidate.onLine, placed),
      );
      if (spot !== undefined) {
        label.route.element.properties["points"] = formatPoints(points);
        return spot.box;
      }
    }
  }
  label.route.points = original;
  return undefined;
};

const placeLabels = (
  geometry: DiagramGeometry,
  moved: readonly Route[],
  metrics: ReadonlyMap<Label, LabelMetrics>,
): void => {
  const movedRoutes = new Set(moved);
  const kept = geometry.labels.filter(
    (label, index) =>
      !movedRoutes.has(label.route) &&
      fits(
        geometry,
        label,
        label.box,
        true,
        geometry.labels.slice(0, index).map((other) => other.box),
      ),
  );
  const placed = kept.map((label) => label.box);
  const keptLabels = new Set(kept);
  geometry.labels
    .filter((label) => !keptLabels.has(label))
    .toSorted((left, right) => right.box.width - left.box.width)
    .forEach((label) => {
      const labelMetrics = metrics.get(label);
      if (labelMetrics === undefined) {
        throw new Error(`the label on ${label.route.from}->${label.route.to} was never measured`);
      }
      const mostLines = Math.min(MOST_LINES, codePoints(label.route.label ?? "").length);
      const spotWith = (count: number): Box | undefined => {
        setLines(label, labelMetrics, count);
        return (
          candidatesFor(label).find((candidate) =>
            fits(geometry, label, candidate.box, candidate.onLine, placed),
          )?.box ?? loopWithRoom(geometry, label, placed)
        );
      };
      let spot: Box | undefined;
      for (let count = naturalLines(label); spot === undefined && count <= mostLines; count += 1) {
        spot = spotWith(count);
      }
      if (spot === undefined) {
        throw new DiagramCrowded({
          reason: `no place along ${label.route.from}->${label.route.to} keeps its label clear of the rest (label centred at ${JSON.stringify(center(label.box))})`,
        });
      }
      moveLabel(label, spot);
      placed.push(spot);
    });
};

const CANVAS_PADDING = 16;

const extentOf = (geometry: DiagramGeometry, canvas: Box): Box => {
  const boxes = [
    canvas,
    ...geometry.shapes.map((shape) => shape.box),
    ...geometry.labels.map((label) => label.box),
    ...geometry.routes.flatMap((route) =>
      route.points.map((point) => ({ height: 0, width: 0, ...point })),
    ),
  ];
  const x = Math.min(...boxes.map((box) => box.x - CANVAS_PADDING), canvas.x);
  const y = Math.min(...boxes.map((box) => box.y - CANVAS_PADDING), canvas.y);
  const right = Math.max(
    ...boxes.map((box) => box.x + box.width + CANVAS_PADDING),
    canvas.x + canvas.width,
  );
  const bottom = Math.max(
    ...boxes.map((box) => box.y + box.height + CANVAS_PADDING),
    canvas.y + canvas.height,
  );
  return { height: bottom - y, width: right - x, x, y };
};

const untangleDiagram = (
  geometry: DiagramGeometry,
  canvas: Box,
): Readonly<{ canvas: Box; overlaps: readonly Overlap[] }> => {
  const metrics = new Map(geometry.labels.map((label) => [label, metricsOf(label)] as const));
  geometry.labels.forEach((label) => {
    setLines(label, metricsOf(label), naturalLines(label));
  });
  const moved = rerouteThroughShapes(geometry);
  placeLabels(geometry, moved, metrics);
  return { canvas: extentOf(geometry, canvas), overlaps: overlapsOf(geometry) };
};

export { untangleDiagram };
