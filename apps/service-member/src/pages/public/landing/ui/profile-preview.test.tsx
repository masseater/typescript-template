import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { overwriteGetLocale, type Locale } from "#paraglide/runtime.js";
import { ProfilePreview } from "./profile-preview.tsx";

const renderedPreview = (locale: Locale): string => {
  overwriteGetLocale(() => locale);
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/signup" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/login" }),
  ]);
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree,
  });
  return renderToStaticMarkup(
    createElement(RouterContextProvider, {
      children: createElement(ProfilePreview),
      router,
    }),
  );
};

describe("landing profile preview", () => {
  it("uses the member page as a sample and keeps follow and message from being actions", () => {
    expect.hasAssertions();
    try {
      const japanese = renderedPreview("ja");
      const english = renderedPreview("en");
      for (const html of [japanese, english]) {
        const hiddenAt = html.indexOf('aria-hidden="true"');
        const hiddenEnd = html.indexOf("</article>", hiddenAt);
        const hidden = html.slice(hiddenAt, hiddenEnd);
        expect(html).toContain('data-slot="member-page"');
        expect(hidden).toContain("山田 花子");
        expect(hidden).toContain("東京");
        expect(hidden).toContain("フォロー");
        expect(hidden).toContain("メッセージ");
        expect(hidden).not.toContain("<a ");
        expect(hidden).not.toContain("<button");
      }
      expect(japanese).toContain("プロフィールの見本");
      expect(japanese).toContain('href="/signup"');
      expect(english).toContain("Sample profile");
      expect(english.indexOf('href="/signup"')).toBeGreaterThan(english.indexOf("</article>"));
    } finally {
      overwriteGetLocale(() => "ja");
    }
  });
});
