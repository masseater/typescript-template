import { RegistryProvider } from "@effect/atom-react";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { WikiFrame } from "./wiki-frame.tsx";

const SPACING_PX = 4;

describe("wiki header icon button", () => {
  const it = test.extend("theTreeButtonTarget", async () => {
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
      history: createMemoryHistory({ initialEntries: ["/wiki"] }),
      routeTree: root.addChildren([index, wiki]),
    });
    await router.load();
    const markup = renderToStaticMarkup(
      createElement(
        RegistryProvider,
        null,
        createElement(
          RouterContextProvider,
          { router },
          createElement(WikiFrame, null, createElement("div")),
        ),
      ),
    );
    const matched =
      /<button\b(?=[^>]*aria-label="文書の木")(?=[^>]*class="([^"]*)")[^>]*>([\s\S]*?)<\/button>/u.exec(
        markup,
      );
    const className = matched?.[1];
    const inner = matched?.[2];
    if (className === undefined || inner === undefined) {
      throw new Error("missing document tree button");
    }
    const spacingPx = (subject: string, utility: string): number => {
      const found = new RegExp(String.raw`(?:^|[\s:])${utility}-(\d+(?:\.\d+)?)(?:\s|$)`).exec(
        subject,
      );
      const units = found?.[1];
      if (units === undefined) {
        throw new Error(`missing ${utility} on ${subject}`);
      }
      return Number(units) * SPACING_PX;
    };
    const glyphClass = /<svg\b[^>]*class="([^"]*)"/u.exec(inner)?.[1];
    if (glyphClass === undefined) {
      throw new Error("missing document tree icon");
    }
    return {
      glyphPx: spacingPx(glyphClass, "size"),
      heightPx: spacingPx(className, "min-h"),
      widthPx: spacingPx(className, "min-w"),
    };
  });

  it("gives the document tree button a 24px box around a 20px glyph", ({ theTreeButtonTarget }) => {
    expect(theTreeButtonTarget).toStrictEqual({ glyphPx: 20, heightPx: 24, widthPx: 24 });
  });
});
