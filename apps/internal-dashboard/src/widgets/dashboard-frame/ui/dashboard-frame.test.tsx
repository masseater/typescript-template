import { RegistryProvider } from "@effect/atom-react";
import { ToastProvider } from "@repo/ui";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { DashboardFrame } from "./dashboard-frame.tsx";

const SPACING_PX = 4;

const paths = ["/", "/inquiries", "/audit", "/flags", "/staff", "/security", "/wiki"] as const;

function renderDashboardFrame(defaultCollapsed: boolean): Promise<string> {
  return Effect.runPromise(
    Effect.gen(function* loadFrame() {
      const rootRoute = createRootRoute({
        component: () =>
          createElement(
            RegistryProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(DashboardFrame, {
                children: createElement("p", null, "本文"),
                defaultCollapsed,
                email: "ada@example.com",
                name: "Ada",
              }),
            ),
          ),
      });
      const router = createRouter({
        history: createMemoryHistory({ initialEntries: ["/inquiries"] }),
        routeTree: rootRoute.addChildren(
          paths.map((path) =>
            createRoute({
              component: () => createElement("span"),
              getParentRoute: () => rootRoute,
              path,
            }),
          ),
        ),
      });
      yield* Effect.promise(() => router.load());
      return renderToStaticMarkup(createElement(RouterProvider, { router }));
    }),
  );
}

function buttonTarget(
  markup: string,
  accessibleName: string,
): Readonly<{
  glyphPx: number;
  heightPx: number;
  widthPx: number;
}> {
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
    throw new Error(`missing icon in ${accessibleName}`);
  }
  return {
    glyphPx: spacingPx(glyphClass, "size"),
    heightPx: spacingPx(className, "min-h"),
    widthPx: spacingPx(className, "min-w"),
  };
}

describe("社内ダッシュボードの枠", () => {
  const it = test
    .extend("theCollapsedFrame", () => renderDashboardFrame(true))
    .extend("theExpandedFrame", () => renderDashboardFrame(false));

  it("折りたたみ時の名前は社内ダッシュボードで、検索欄はない", ({ theCollapsedFrame }) => {
    expect.hasAssertions();
    expect(theCollapsedFrame).toContain("min-h-dvh bg-muted");
    expect(theCollapsedFrame).toContain("rounded-lg");
    expect(theCollapsedFrame).toContain('<span class="sr-only">社内ダッシュボード</span>');
    expect(theCollapsedFrame).toContain('<span aria-hidden="true">社内</span>');
    expect(theCollapsedFrame).toContain('href="/inquiries"');
    expect(theCollapsedFrame).toContain("問い合わせ");
    expect(theCollapsedFrame).toContain("Google Analytics");
    expect(theCollapsedFrame).toContain('href="/wiki"');
    expect(theCollapsedFrame).toContain("本文");
    expect(theCollapsedFrame).not.toContain("<input");
    expect(theCollapsedFrame).not.toContain("この画面内を検索");
    expect(theCollapsedFrame).not.toContain(">社<");
  });

  it("ヘッダーのアイコンは 24px の中に 20px の字形を置く", ({ theExpandedFrame }) => {
    expect.hasAssertions();
    expect(buttonTarget(theExpandedFrame, "メニュー")).toStrictEqual({
      glyphPx: 20,
      heightPx: 24,
      widthPx: 24,
    });
    expect(buttonTarget(theExpandedFrame, "サイドバーを畳む")).toStrictEqual({
      glyphPx: 20,
      heightPx: 24,
      widthPx: 24,
    });
    expect(theExpandedFrame).toContain("状況と運営");
    expect(theExpandedFrame).toContain(">概要<");
  });
});
