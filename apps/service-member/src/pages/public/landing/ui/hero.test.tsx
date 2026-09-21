import { readFileSync } from "node:fs";

import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { serviceName } from "#shared/config/index.ts";
import { m } from "#shared/i18n/index.ts";
import { Hero } from "./hero.tsx";

import type { ReactElement } from "react";

function remTextSize(line: string): readonly [string, number] | undefined {
  const declaration = line.trim().replace(/;$/u, "");
  const separator = declaration.indexOf(":");
  if (separator < 0) {
    return undefined;
  }
  const name = declaration.slice(0, separator).trim();
  const value = declaration.slice(separator + 1).trim();
  if (!name.startsWith("--text-") || name.includes("*") || name.includes("--line-height")) {
    return undefined;
  }
  if (!value.endsWith("rem")) {
    throw new Error(`${name} is not a rem text size`);
  }
  return [name.slice("--".length), Number(value.slice(0, -"rem".length))];
}

const textSizes = new Map(
  readFileSync(new URL("../../../../../../../libs/ui/src/styles.css", import.meta.url), "utf8")
    .split("\n")
    .flatMap((line) => {
      const token = remTextSize(line);
      return token === undefined ? [] : [token];
    }),
);

if (textSizes.size === 0) {
  throw new Error("design system text sizes are missing");
}

const textSizeUtility = /^(?:md:)?text-(?:2xs|xs|sm|base|lg|[2-9]?xl)$/u;

function sizeOf(utility: string): number {
  const size = textSizes.get(utility);
  if (size === undefined) {
    throw new Error(`${utility} is not a design-system text size`);
  }
  return size;
}

function fontSize(className: string, breakpoint: "default" | "md"): number {
  let base: number | undefined;
  let atMd: number | undefined;
  for (const token of className.split(/\s+/u)) {
    if (!textSizeUtility.test(token)) {
      continue;
    }
    const size = sizeOf(token.startsWith("md:") ? token.slice("md:".length) : token);
    if (token.startsWith("md:")) {
      atMd = size;
    } else {
      base = size;
    }
  }
  if (base === undefined) {
    throw new Error(`missing text size in ${className}`);
  }
  return breakpoint === "md" && atMd !== undefined ? atMd : base;
}

function openTag(html: string, text: string): string {
  const markerAt = html.indexOf(`>${text}<`);
  if (markerAt < 0) {
    throw new Error(`rendered hero is missing ${text}`);
  }
  const start = html.lastIndexOf("<", markerAt);
  return html.slice(start, html.indexOf(">", start) + 1);
}

function classNameOf(html: string, text: string): string {
  const tag = openTag(html, text);
  const marker = 'class="';
  const start = tag.indexOf(marker);
  if (start < 0) {
    throw new Error(`rendered hero text has no class: ${text}`);
  }
  const from = start + marker.length;
  return tag.slice(from, tag.indexOf('"', from));
}

function Empty(): ReactElement {
  return createElement("span");
}

function renderedHero(): Effect.Effect<string> {
  return Effect.gen(function* loadHero() {
    const rootRoute = createRootRoute({ component: Hero });
    const signup = createRoute({
      component: Empty,
      getParentRoute: () => rootRoute,
      path: "/signup",
    });
    const login = createRoute({
      component: Empty,
      getParentRoute: () => rootRoute,
      path: "/login",
    });
    const router = createRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
      routeTree: rootRoute.addChildren([signup, login]),
    });
    yield* Effect.promise(() => router.load());
    return renderToStaticMarkup(createElement(RouterProvider, { router }));
  });
}

describe("landing hero", () => {
  it("renders the headline larger than the product name above it", () =>
    Effect.runPromise(
      Effect.gen(function* compareHeadline() {
        expect.hasAssertions();
        const html = yield* renderedHero();
        const headline = m.hero_title();
        expect(html.indexOf(headline)).toBeGreaterThan(html.indexOf(serviceName));
        expect(fontSize(classNameOf(html, headline), "default")).toBeGreaterThan(
          fontSize(classNameOf(html, serviceName), "default"),
        );
        expect(fontSize(classNameOf(html, headline), "md")).toBeGreaterThan(
          fontSize(classNameOf(html, serviceName), "md"),
        );
      }),
    ));
});
