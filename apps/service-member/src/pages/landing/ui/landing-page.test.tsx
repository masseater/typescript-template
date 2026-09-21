import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { FieldValidationMessageProvider } from "@repo/ui";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { overwriteGetLocale, type Locale } from "#paraglide/runtime.js";
import { fieldValidationMessages } from "#shared/i18n/index.ts";
import { Consequences } from "./consequences.tsx";
import { Hero } from "./hero.tsx";

const landingKeys = [
  "closing_title",
  "consequences_body",
  "consequences_title",
  "feature_profile_body",
  "feature_profile_title",
  "feature_search_body",
  "feature_search_title",
  "feature_security_body",
  "feature_security_title",
  "signup_link",
] as const;

type LandingCopy = Record<(typeof landingKeys)[number], string>;

const landingCopy = (locale: Locale): LandingCopy => {
  const parsed: unknown = JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../../../messages/${locale}.json`, import.meta.url)),
      "utf8",
    ),
  );
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${locale} messages must be a JSON object`);
  }
  const catalog = parsed as Record<string, unknown>;
  return Object.fromEntries(
    landingKeys.map((key) => {
      const value = catalog[key];
      if (typeof value !== "string") {
        throw new Error(`${locale} messages must include ${key}`);
      }
      return [key, value];
    }),
  ) as LandingCopy;
};

const rendered = (locale: Locale, view: ReactElement): string => {
  overwriteGetLocale(() => locale);
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/signup" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/login" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/users" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/users/$id" }),
  ]);
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree,
  });
  return renderToStaticMarkup(
    createElement(
      RouterContextProvider,
      { router },
      createElement(
        FieldValidationMessageProvider,
        { messages: fieldValidationMessages(locale) },
        view,
      ),
    ),
  );
};

const englishCopy = {
  closing_title: "Let's get started",
  consequences_body:
    "Finding people and making login stronger both follow from having your own page.",
  consequences_title: "Once you have a page",
  feature_profile_body: "Write your name and an introduction, and have your own page.",
  feature_profile_title: "Create a profile",
  feature_search_body: "Search by name and open the profile of someone you care about.",
  feature_search_title: "Find other members",
  feature_security_body: "Make login stronger with passkeys and two-factor authentication.",
  feature_security_title: "Protect your account",
  signup_link: "Sign up",
} as const satisfies LandingCopy;

const japaneseCopy = {
  closing_title: "さっそく始めましょう",
  consequences_body:
    "気になる人を探すことも、ログインを強くすることも、自分のページがあってからのことです。",
  consequences_title: "ページを持つと",
  feature_profile_body: "名前と自己紹介を書いて、自分のページを持てます。",
  feature_profile_title: "プロフィールを作る",
  feature_search_body: "名前で検索して、気になる人のプロフィールを開けます。",
  feature_search_title: "他の利用者を探す",
  feature_security_body: "パスキーと 2 段階認証で、ログインを強くできます。",
  feature_security_title: "アカウントを守る",
  signup_link: "新規登録",
} as const satisfies LandingCopy;

function expectLanding(html: string, copy: LandingCopy): void {
  const pageAt = html.indexOf('data-slot="member-page"');
  const pageEnd = html.indexOf("</article>", pageAt);
  const page = html.slice(pageAt, pageEnd);
  expect(pageAt).toBeGreaterThanOrEqual(0);
  expect(page).toContain("h-24");
  expect(page).toContain("-mt-10");
  expect(page).toContain("山田 花子");
  expect(html.indexOf('href="/signup"')).toBeGreaterThan(pageAt);
  expect(html).toContain(copy.feature_profile_title);
  expect(html).toContain(copy.feature_profile_body);
  expect(html).toContain(copy.signup_link);
  expect(html).toContain(copy.consequences_title);
  expect(html).toContain(copy.consequences_body);
  expect(html).toContain(copy.feature_search_title);
  expect(html).toContain("名前で検索");
  expect(html).toContain(copy.feature_security_title);
  expect(html).toContain("パスキーの名前");
  expect(html).toContain("認証アプリは設定済みです。");
  expect(html).not.toContain("md:grid-cols-2");
  expect(html).not.toContain("h-2.5 w-2/3");
}

describe("landing in English", () => {
  const it = test
    .extend("catalog", () => landingCopy("en"))
    .extend("hero", () => rendered("en", createElement(Hero)))
    .extend("consequences", () => rendered("en", createElement(Consequences)));

  it("reads the English catalog", ({ catalog }) => {
    expect.hasAssertions();
    expect(catalog).toStrictEqual(englishCopy);
  });

  it("builds the page first and shows search and security as consequences", ({
    consequences,
    hero,
  }) => {
    expect.hasAssertions();
    try {
      const closing = "Let&#x27;s get started";
      expect(hero).toContain(closing);
      expectLanding(`${hero}${consequences}`, { ...englishCopy, closing_title: closing });
    } finally {
      overwriteGetLocale(() => "ja");
    }
  });
});

describe("landing in Japanese", () => {
  const it = test
    .extend("catalog", () => landingCopy("ja"))
    .extend("hero", () => rendered("ja", createElement(Hero)))
    .extend("consequences", () => rendered("ja", createElement(Consequences)));

  it("keeps the Japanese catalog", ({ catalog }) => {
    expect.hasAssertions();
    expect(catalog).toStrictEqual(japaneseCopy);
  });

  it("builds the page first and shows search and security as consequences", ({
    consequences,
    hero,
  }) => {
    expect.hasAssertions();
    try {
      expectLanding(`${hero}${consequences}`, japaneseCopy);
      expect(hero).toContain(japaneseCopy.closing_title);
    } finally {
      overwriteGetLocale(() => "ja");
    }
  });
});
