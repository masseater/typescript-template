import { DiagramCrowded } from "./diagram-crowded.ts";
import { inflate } from "./diagram-geometry.ts";
import {
  collinearOverlap,
  segmentBox,
  segmentEntersBox,
  type Segment,
} from "./diagram-overlaps.ts";

import type { Box, Point } from "./diagram-geometry.ts";

type Direction = Readonly<{ x: -1 | 0 | 1; y: -1 | 0 | 1 }>;

type RouteRequest = Readonly<{
  arrival: Direction;
  crossable: readonly Segment[];
  departure: Direction;
  end: Point;
  endShape: Box;
  obstacles: readonly Box[];
  start: Point;
  startShape: Box;
}>;

const CLEARANCE = 12;
const LANE_GAP = 12;
const LANES = 4;
const PORT = 24;
const BEND_COST = 40;
const CROSSING_COST = 15;

const directions: readonly Direction[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const step = (point: Point, direction: Direction, distance: number): Point => ({
  x: point.x + direction.x * distance,
  y: point.y + direction.y * distance,
});

const lanesAround = (low: number, high: number): readonly number[] =>
  Array.from({ length: LANES }, (_, lane) => [
    low - lane * LANE_GAP,
    high + lane * LANE_GAP,
  ]).flat();

const uniqueSorted = (values: readonly number[]): readonly number[] =>
  [...new Set(values.map((value) => Math.round(value * 1000) / 1000))].toSorted((a, b) => a - b);

const crossings = (segment: Segment, crossable: readonly Segment[]): number =>
  crossable.filter((other) => segmentEntersBox(segment, inflate(segmentBox(other), 0.5))).length;

const simplify = (points: readonly Point[]): readonly Point[] =>
  points.filter((point, index) => {
    const before = points[index - 1];
    const after = points[index + 1];
    if (before === undefined || after === undefined) {
      return true;
    }
    const sameX = Math.abs(before.x - point.x) < 0.01 && Math.abs(point.x - after.x) < 0.01;
    const sameY = Math.abs(before.y - point.y) < 0.01 && Math.abs(point.y - after.y) < 0.01;
    return !(sameX || sameY);
  });

type Entry = Readonly<{ cost: number; state: number }>;

const swap = (heap: Entry[], left: number, right: number): void => {
  const leftEntry = heap[left];
  const rightEntry = heap[right];
  if (leftEntry !== undefined && rightEntry !== undefined) {
    heap[left] = rightEntry;
    heap[right] = leftEntry;
  }
};

const costAt = (heap: readonly Entry[], index: number): number =>
  heap[index]?.cost ?? Number.POSITIVE_INFINITY;

const push = (heap: Entry[], entry: Entry): void => {
  heap.push(entry);
  for (let index = heap.length - 1; index > 0;) {
    const parent = Math.floor((index - 1) / 2);
    if (costAt(heap, parent) <= costAt(heap, index)) {
      return;
    }
    swap(heap, parent, index);
    index = parent;
  }
};

const pop = (heap: Entry[]): Entry | undefined => {
  const top = heap[0];
  const last = heap.pop();
  if (top === undefined || last === undefined || heap.length === 0) {
    return top;
  }
  heap[0] = last;
  for (let index = 0; ;) {
    const left = index * 2 + 1;
    const right = left + 1;
    const smallest = [left, right].reduce(
      (best, child) => (costAt(heap, child) < costAt(heap, best) ? child : best),
      index,
    );
    if (smallest === index) {
      return top;
    }
    swap(heap, smallest, index);
    index = smallest;
  }
};

const clearOf = (point: Point, direction: Direction, shape: Box): number => {
  const wall = inflate(shape, CLEARANCE);
  const exits = [
    direction.x > 0 ? wall.x + wall.width - point.x : undefined,
    direction.x < 0 ? point.x - wall.x : undefined,
    direction.y > 0 ? wall.y + wall.height - point.y : undefined,
    direction.y < 0 ? point.y - wall.y : undefined,
  ].filter((distance) => distance !== undefined);
  return Math.max(PORT, ...exits);
};

const routeAround = (request: RouteRequest): readonly Point[] => {
  const orthogonal = (direction: Direction): boolean =>
    directions.some((candidate) => candidate.x === direction.x && candidate.y === direction.y);
  if (!orthogonal(request.departure) || !orthogonal(request.arrival)) {
    throw new Error(
      "a route can only be re-routed when both of its ends run horizontally or vertically",
    );
  }
  const walls = request.obstacles.map((obstacle) => inflate(obstacle, CLEARANCE - 0.5));
  const departurePort = step(
    request.start,
    request.departure,
    clearOf(request.start, request.departure, request.startShape),
  );
  const backwards = { x: -request.arrival.x, y: -request.arrival.y } as Direction;
  const arrivalPort = step(
    request.end,
    backwards,
    clearOf(request.end, backwards, request.endShape),
  );
  const xs = uniqueSorted([
    departurePort.x,
    arrivalPort.x,
    ...request.obstacles.flatMap((box) =>
      lanesAround(box.x - CLEARANCE, box.x + box.width + CLEARANCE),
    ),
  ]);
  const ys = uniqueSorted([
    departurePort.y,
    arrivalPort.y,
    ...request.obstacles.flatMap((box) =>
      lanesAround(box.y - CLEARANCE, box.y + box.height + CLEARANCE),
    ),
  ]);
  const open = (point: Point): boolean =>
    !walls.some(
      (wall) =>
        point.x > wall.x &&
        point.x < wall.x + wall.width &&
        point.y > wall.y &&
        point.y < wall.y + wall.height,
    );
  const passable = (segment: Segment): boolean =>
    !walls.some((wall) => segmentEntersBox(segment, wall)) &&
    !request.crossable.some((other) => collinearOverlap(segment, other));
  const key = (xIndex: number, yIndex: number, direction: number): number =>
    (xIndex * ys.length + yIndex) * directions.length + direction;
  const indexOf = (values: readonly number[], value: number): number =>
    values.findIndex((candidate) => Math.abs(candidate - Math.round(value * 1000) / 1000) < 0.001);
  const startX = indexOf(xs, departurePort.x);
  const startY = indexOf(ys, departurePort.y);
  const goalX = indexOf(xs, arrivalPort.x);
  const goalY = indexOf(ys, arrivalPort.y);
  const departureIndex = directions.findIndex(
    (direction) => direction.x === request.departure.x && direction.y === request.departure.y,
  );
  const arrivalIndex = directions.findIndex(
    (direction) => direction.x === request.arrival.x && direction.y === request.arrival.y,
  );
  const cost = new Map<number, number>([[key(startX, startY, departureIndex), 0]]);
  const cameFrom = new Map<number, number>();
  const frontier: Entry[] = [{ cost: 0, state: key(startX, startY, departureIndex) }];
  const settled = new Set<number>();
  let reached: number | undefined;
  while (frontier.length > 0) {
    const current = pop(frontier);
    if (current === undefined || settled.has(current.state)) {
      continue;
    }
    settled.add(current.state);
    const direction = current.state % directions.length;
    const cell = Math.floor(current.state / directions.length);
    const xIndex = Math.floor(cell / ys.length);
    const yIndex = cell % ys.length;
    if (xIndex === goalX && yIndex === goalY) {
      reached = current.state;
      break;
    }
    const here = { x: xs[xIndex] ?? 0, y: ys[yIndex] ?? 0 };
    directions.forEach((move, moveIndex) => {
      const nextX = xIndex + move.x;
      const nextY = yIndex + move.y;
      const nextPoint = { x: xs[nextX], y: ys[nextY] };
      if (nextPoint.x === undefined || nextPoint.y === undefined) {
        return;
      }
      const there = { x: nextPoint.x, y: nextPoint.y };
      const segment: Segment = [here, there];
      if (!open(there) || !passable(segment)) {
        return;
      }
      const nextState = key(nextX, nextY, moveIndex);
      const arrivalTurn =
        nextX === goalX && nextY === goalY && moveIndex !== arrivalIndex ? BEND_COST : 0;
      const nextCost =
        current.cost +
        Math.hypot(there.x - here.x, there.y - here.y) +
        (moveIndex === direction ? 0 : BEND_COST) +
        crossings(segment, request.crossable) * CROSSING_COST +
        arrivalTurn;
      if (nextCost < (cost.get(nextState) ?? Number.POSITIVE_INFINITY)) {
        cost.set(nextState, nextCost);
        cameFrom.set(nextState, current.state);
        push(frontier, { cost: nextCost, state: nextState });
      }
    });
  }
  if (reached === undefined) {
    throw new DiagramCrowded({
      reason: "no orthogonal route leads around the shapes between these ends",
    });
  }
  const path: Point[] = [];
  for (let state: number | undefined = reached; state !== undefined; state = cameFrom.get(state)) {
    const cell = Math.floor(state / directions.length);
    path.unshift({ x: xs[Math.floor(cell / ys.length)] ?? 0, y: ys[cell % ys.length] ?? 0 });
  }
  return simplify([request.start, ...path, request.end]);
};

export { routeAround };
export type { Direction };
