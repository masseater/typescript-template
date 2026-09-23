import { describe, expect, it } from "vite-plus/test";

import { routeAround } from "./route-around.ts";

const shape = { height: 20, width: 20, x: 0, y: 0 };

describe("routeAround", () => {
  it("refuses a route whose end leaves its shape diagonally", () => {
    expect(() =>
      routeAround({
        arrival: { x: 1, y: 0 },
        crossable: [],
        departure: { x: 1, y: 1 },
        end: { x: 200, y: 10 },
        endShape: { ...shape, x: 200 },
        obstacles: [shape, { ...shape, x: 200 }],
        start: { x: 20, y: 10 },
        startShape: shape,
      }),
    ).toThrow("a route can only be re-routed when both of its ends run horizontally or vertically");
  });

  it("leads a route around a shape that stands between its ends", () => {
    const blocker = { height: 60, width: 20, x: 90, y: -20 };
    const points = routeAround({
      arrival: { x: 1, y: 0 },
      crossable: [],
      departure: { x: 1, y: 0 },
      end: { x: 200, y: 10 },
      endShape: { ...shape, x: 200 },
      obstacles: [shape, blocker, { ...shape, x: 200 }],
      start: { x: 20, y: 10 },
      startShape: shape,
    });
    expect(
      points.slice(1).every((point, index) => {
        const previous = points[index];
        return previous !== undefined && (previous.x === point.x || previous.y === point.y);
      }),
    ).toBe(true);
    expect(
      points.some((point) => point.y < blocker.y || point.y > blocker.y + blocker.height),
    ).toBe(true);
  });
});
