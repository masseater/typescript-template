import { segmentsOf } from "./diagram-geometry.ts";

import type { Box, DiagramGeometry, Label, Point, Route } from "./diagram-geometry.ts";

type Overlap = Readonly<{
  kind:
    | "label-label"
    | "label-route"
    | "label-shape"
    | "route-route"
    | "route-through-shape"
    | "shape-shape";
  subjects: readonly string[];
}>;

type Segment = readonly [Point, Point];

const MARK_PADDING = 3;
const EPSILON = 0.5;

const boxesOverlap = (left: Box, right: Box): boolean =>
  left.x < right.x + right.width - EPSILON &&
  right.x < left.x + left.width - EPSILON &&
  left.y < right.y + right.height - EPSILON &&
  right.y < left.y + left.height - EPSILON;

const segmentBox = ([start, end]: Segment): Box => ({
  height: Math.abs(end.y - start.y),
  width: Math.abs(end.x - start.x),
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
});

const segmentEntersBox = (segment: Segment, box: Box): boolean => {
  const bounds = segmentBox(segment);
  return (
    bounds.x < box.x + box.width - EPSILON &&
    bounds.x + bounds.width > box.x + EPSILON &&
    bounds.y < box.y + box.height - EPSILON &&
    bounds.y + bounds.height > box.y + EPSILON
  );
};

const horizontal = ([start, end]: Segment): boolean => Math.abs(start.y - end.y) < EPSILON;

const collinearOverlap = (left: Segment, right: Segment): boolean => {
  if (horizontal(left) !== horizontal(right)) {
    return false;
  }
  const axis = horizontal(left) ? "x" : "y";
  const across = horizontal(left) ? "y" : "x";
  if (Math.abs(left[0][across] - right[0][across]) >= 1) {
    return false;
  }
  const [leftStart, leftEnd] = [left[0][axis], left[1][axis]].toSorted((a, b) => a - b);
  const [rightStart, rightEnd] = [right[0][axis], right[1][axis]].toSorted((a, b) => a - b);
  return (
    leftStart !== undefined &&
    leftEnd !== undefined &&
    rightStart !== undefined &&
    rightEnd !== undefined &&
    Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart) > 1
  );
};

const shareAnEnd = (left: Route, right: Route): boolean =>
  left.from === right.from || left.to === right.to;

const markZones = (route: Route): readonly Box[] => {
  const [first, second] = route.points;
  const [last, beforeLast] = route.points.toReversed();
  return (
    [
      [first, second, route.marks.start],
      [last, beforeLast, route.marks.end],
    ] as const
  ).flatMap(([end, toward, markLength]) => {
    if (end === undefined || toward === undefined || markLength === 0) {
      return [];
    }
    const length = Math.hypot(toward.x - end.x, toward.y - end.y);
    const reach = Math.min(markLength, length) / length;
    const tip = { x: end.x + (toward.x - end.x) * reach, y: end.y + (toward.y - end.y) * reach };
    const bounds = segmentBox([end, tip]);
    return [
      {
        height: bounds.height + MARK_PADDING * 2,
        width: bounds.width + MARK_PADDING * 2,
        x: bounds.x - MARK_PADDING,
        y: bounds.y - MARK_PADDING,
      },
    ];
  });
};

const labelName = (label: Label): string => `label ${label.route.from}->${label.route.to}`;
const routeName = (route: Route): string => `route ${route.from}->${route.to}`;

const labelCrossesRoute = (label: Label, route: Route): boolean =>
  (route !== label.route &&
    segmentsOf(route.points).some((segment) => segmentEntersBox(segment, label.box))) ||
  markZones(route).some((zone) => boxesOverlap(zone, label.box));

const found = (condition: boolean, overlap: Overlap): readonly Overlap[] =>
  condition ? [overlap] : [];

const overlapsOf = (geometry: DiagramGeometry): readonly Overlap[] => {
  const { labels, routes, shapes } = geometry;
  return [
    ...shapes.flatMap((shape, index) =>
      shapes.slice(index + 1).flatMap((other) =>
        found(boxesOverlap(shape.box, other.box), {
          kind: "shape-shape",
          subjects: [shape.id, other.id],
        }),
      ),
    ),
    ...routes.flatMap((route) =>
      shapes.flatMap((shape) =>
        found(
          shape.id !== route.from &&
            shape.id !== route.to &&
            segmentsOf(route.points).some((segment) => segmentEntersBox(segment, shape.box)),
          { kind: "route-through-shape", subjects: [routeName(route), shape.id] },
        ),
      ),
    ),
    ...routes.flatMap((route, index) =>
      routes
        .slice(index + 1)
        .flatMap((other) =>
          found(
            !shareAnEnd(route, other) &&
              segmentsOf(route.points).some((segment) =>
                segmentsOf(other.points).some((otherSegment) =>
                  collinearOverlap(segment, otherSegment),
                ),
              ),
            { kind: "route-route", subjects: [routeName(route), routeName(other)] },
          ),
        ),
    ),
    ...labels.flatMap((label, index) => [
      ...shapes.flatMap((shape) =>
        found(boxesOverlap(label.box, shape.box), {
          kind: "label-shape",
          subjects: [labelName(label), shape.id],
        }),
      ),
      ...labels.slice(index + 1).flatMap((other) =>
        found(boxesOverlap(label.box, other.box), {
          kind: "label-label",
          subjects: [labelName(label), labelName(other)],
        }),
      ),
      ...routes.flatMap((route) =>
        found(labelCrossesRoute(label, route), {
          kind: "label-route",
          subjects: [labelName(label), routeName(route)],
        }),
      ),
    ]),
  ];
};

export {
  boxesOverlap,
  collinearOverlap,
  markZones,
  overlapsOf,
  segmentBox,
  segmentEntersBox,
  shareAnEnd,
};
export type { Overlap, Segment };
