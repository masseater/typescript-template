import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { DashboardHeader } from "./dashboard-header.tsx";

const SPACING_PX = 4;

describe("dashboard header icon buttons", () => {
  const it = test.extend("theHeaderTargets", () =>
    Effect.runPromise(
      Effect.gen(function* loadHeader() {
        const root = createRootRoute();
        const index = createRoute({
          component: () => createElement("div"),
          getParentRoute: () => root,
          path: "/",
        });
        const wiki = createRoute({
          component: () => createElement("div"),
          getParentRoute: () => root,
          path: "/wiki",
        });
        const router = createRouter({
          history: createMemoryHistory({ initialEntries: ["/"] }),
          routeTree: root.addChildren([index, wiki]),
        });
        yield* Effect.promise(() => router.load());
        const markup = renderToStaticMarkup(
          <RouterContextProvider router={router}>
            <DashboardHeader
              collapsed={false}
              navigationOpen={false}
              onToggleCollapsed={() => undefined}
              onToggleNavigation={() => undefined}
            />
          </RouterContextProvider>,
        );
        return ["メニュー", "サイドバーを畳む"].map((accessibleName) => {
          const matched = new RegExp(
            `<button\\b(?=[^>]*aria-label="${accessibleName}")(?=[^>]*class="([^"]*)")[^>]*>([\\s\\S]*?)</button>`,
            "u",
          ).exec(markup);
          const className = matched?.[1];
          const inner = matched?.[2];
          if (className === undefined || inner === undefined) {
            throw new Error(`missing button ${accessibleName}`);
          }
          const spacingPx = (subject: string, utility: string): number => {
            const found = new RegExp(
              String.raw`(?:^|[\s:])${utility}-(\d+(?:\.\d+)?)(?:\s|$)`,
            ).exec(subject);
            const units = found?.[1];
            if (units === undefined) {
              throw new Error(`missing ${utility} on ${subject}`);
            }
            return Number(units) * SPACING_PX;
          };
          const glyphClass = /<svg\b[^>]*class="([^"]*)"/u.exec(inner)?.[1];
          if (glyphClass === undefined) {
            throw new Error(`missing icon in ${accessibleName}`);
          }
          return {
            accessibleName,
            glyphPx: spacingPx(glyphClass, "size"),
            heightPx: spacingPx(className, "min-h"),
            widthPx: spacingPx(className, "min-w"),
          };
        });
      }),
    ));

  it("gives each icon button a 24px box around a 20px glyph", ({ theHeaderTargets }) => {
    expect(theHeaderTargets).toStrictEqual([
      { accessibleName: "メニュー", glyphPx: 20, heightPx: 24, widthPx: 24 },
      { accessibleName: "サイドバーを畳む", glyphPx: 20, heightPx: 24, widthPx: 24 },
    ]);
  });
});
