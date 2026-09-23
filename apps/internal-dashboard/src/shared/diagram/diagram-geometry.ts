import type { Element, ElementContent, Root } from "hast";

type Point = Readonly<{ x: number; y: number }>;
type Box = Readonly<{ height: number; width: number; x: number; y: number }>;

type Shape = Readonly<{ box: Box; id: string }>;

type Route = {
  readonly element: Element;
  readonly from: string;
  readonly label: string | undefined;
  readonly marks: Readonly<{ end: number; start: number }>;
  points: readonly Point[];
  readonly to: string;
};

type Label = {
  box: Box;
  readonly frame: Element;
  readonly route: Route;
  readonly text: Element;
};

type DiagramGeometry = Readonly<{
  labels: readonly Label[];
  routes: readonly Route[];
  shapes: readonly Shape[];
}>;

const isElement = (node: ElementContent | Root["children"][number]): node is Element =>
  node.type === "element";

const classesOf = (element: Element): readonly string[] => {
  const classes = element.properties["className"];
  return Array.isArray(classes) ? classes.map(String) : [];
};

const hasClass = (element: Element, name: string): boolean => classesOf(element).includes(name);

const stringProperty = (element: Element, name: string): string => {
  const value = element.properties[name];
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`<${element.tagName}> has no ${name}`);
  }
  return String(value);
};

const optionalString = (element: Element, name: string): string | undefined => {
  const value = element.properties[name];
  return typeof value === "string" ? value : undefined;
};

const numberProperty = (element: Element, name: string): number => {
  const value = Number(stringProperty(element, name));
  if (!Number.isFinite(value)) {
    throw new Error(`<${element.tagName}> has a ${name} that is not a number`);
  }
  return value;
};

const parsePoints = (points: string): readonly Point[] =>
  points
    .trim()
    .split(/\s+/u)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`the polyline point ${pair} is not a coordinate pair`);
      }
      return { x, y };
    });

const formatPoints = (points: readonly Point[]): string =>
  points.map((point) => `${point.x},${point.y}`).join(" ");

const boundsOf = (points: readonly Point[]): Box => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { height: Math.max(...ys) - y, width: Math.max(...xs) - x, x, y };
};

const outlineOf = (element: Element): Box => {
  const outline = element.children.filter(isElement)[0];
  if (outline === undefined) {
    throw new Error("a diagram shape has no outline");
  }
  switch (outline.tagName) {
    case "rect": {
      return {
        height: numberProperty(outline, "height"),
        width: numberProperty(outline, "width"),
        x: numberProperty(outline, "x"),
        y: numberProperty(outline, "y"),
      };
    }
    case "polygon": {
      return boundsOf(parsePoints(stringProperty(outline, "points")));
    }
    case "circle": {
      const radius = numberProperty(outline, "r");
      return {
        height: radius * 2,
        width: radius * 2,
        x: numberProperty(outline, "cx") - radius,
        y: numberProperty(outline, "cy") - radius,
      };
    }
    default: {
      throw new Error(`a diagram shape is outlined by <${outline.tagName}>, which has no box`);
    }
  }
};

const textOf = (node: ElementContent): string =>
  node.type === "text"
    ? node.value
    : node.type === "element"
      ? node.children.map((child) => textOf(child)).join("")
      : "";

const boxOfFrame = (frame: Element): Box => ({
  height: numberProperty(frame, "height"),
  width: numberProperty(frame, "width"),
  x: numberProperty(frame, "x"),
  y: numberProperty(frame, "y"),
});

const center = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

const segmentsOf = (points: readonly Point[]): readonly (readonly [Point, Point])[] =>
  points.slice(1).map((point, index) => [points[index] ?? point, point] as const);

const svgOf = (root: Root): Element => {
  const svg = root.children.filter(isElement).find((element) => element.tagName === "svg");
  if (svg === undefined) {
    throw new Error("the rendered diagram has no <svg>");
  }
  return svg;
};

const CROW_FOOT_LENGTH = 24;
const ARROW_LENGTH = 10;

const arrowAt = (element: Element, end: "dataArrowEnd" | "dataArrowStart"): number =>
  optionalString(element, end) === "true" ? ARROW_LENGTH : 0;

const routeOf = (element: Element): Route => {
  const erRoute = hasClass(element, "er-relationship");
  return {
    element,
    from: stringProperty(element, erRoute ? "dataEntity1" : "dataFrom"),
    label: optionalString(element, "dataLabel"),
    marks: erRoute
      ? { end: CROW_FOOT_LENGTH, start: CROW_FOOT_LENGTH }
      : { end: arrowAt(element, "dataArrowEnd"), start: arrowAt(element, "dataArrowStart") },
    points: parsePoints(stringProperty(element, "points")),
    to: stringProperty(element, erRoute ? "dataEntity2" : "dataTo"),
  };
};

const distanceToSegment = (point: Point, [start, end]: readonly [Point, Point]): number => {
  const length = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  const along =
    length === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) /
              length,
          ),
        );
  return Math.hypot(
    point.x - (start.x + along * (end.x - start.x)),
    point.y - (start.y + along * (end.y - start.y)),
  );
};

const distanceToRoute = (point: Point, route: Route): number =>
  Math.min(...segmentsOf(route.points).map((segment) => distanceToSegment(point, segment)));

const labelFor = (
  routes: readonly Route[],
  frame: Element,
  text: Element,
  carries: (route: Route) => boolean,
): Label => {
  const box = boxOfFrame(frame);
  const words = textOf(text);
  if (optionalString(text, "textAnchor") !== "middle") {
    throw new Error(`the label "${words}" is not centred on its frame`);
  }
  const route = routes
    .filter((candidate) => candidate.label === words && carries(candidate))
    .toSorted(
      (left, right) => distanceToRoute(center(box), left) - distanceToRoute(center(box), right),
    )[0];
  if (route === undefined) {
    throw new Error(`the label "${words}" sits on no relationship that carries it`);
  }
  return { box, frame, route, text };
};

const pairedLabels = (children: readonly Element[], routes: readonly Route[]): readonly Label[] => {
  const labelled = new Set<Route>();
  const claim = (label: Label): Label => {
    if (labelled.has(label.route)) {
      throw new Error(`two labels claim the route ${label.route.from}->${label.route.to}`);
    }
    labelled.add(label.route);
    return label;
  };
  return children.flatMap((child, index) => {
    if (hasClass(child, "edge-label")) {
      const [frame, text] = child.children.filter(isElement);
      if (frame?.tagName !== "rect" || text?.tagName !== "text") {
        throw new Error("an edge label is not a frame followed by its text");
      }
      const from = stringProperty(child, "dataFrom");
      const to = stringProperty(child, "dataTo");
      return [
        claim(
          labelFor(
            routes,
            frame,
            text,
            (route) => route.from === from && route.to === to && !labelled.has(route),
          ),
        ),
      ];
    }
    const next = children[index + 1];
    return child.tagName === "rect" && next?.tagName === "text"
      ? [claim(labelFor(routes, child, next, (route) => !labelled.has(route)))]
      : [];
  });
};

const readGeometry = (root: Root): DiagramGeometry => {
  const children = svgOf(root).children.filter(isElement);
  const routes = children.flatMap((child) =>
    hasClass(child, "edge") || hasClass(child, "er-relationship") ? [routeOf(child)] : [],
  );
  return {
    labels: pairedLabels(children, routes),
    routes,
    shapes: children.flatMap((child) =>
      hasClass(child, "node") || hasClass(child, "entity")
        ? [{ box: outlineOf(child), id: stringProperty(child, "dataId") }]
        : [],
    ),
  };
};

export { center, formatPoints, readGeometry, segmentsOf, svgOf };
export type { Box, DiagramGeometry, Label, Point, Route };
