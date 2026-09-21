import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { paraglideMiddleware } from "#paraglide/server.js";
import { Closing } from "./closing.tsx";
import { Features } from "./features.tsx";

const landingKeys = [
  "closing_title",
  "feature_profile_body",
  "feature_profile_title",
  "feature_search_body",
  "feature_search_title",
  "feature_security_body",
  "feature_security_title",
  "features_title",
  "signup_link",
] as const;

type LandingCopy = Record<(typeof landingKeys)[number], string>;

const landingCopy = (locale: "en" | "ja"): LandingCopy => {
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

const rendered = (pathname: string, view: ReactElement): Promise<string> => {
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [pathname] }),
    routeTree: createRootRoute(),
  });
  return paraglideMiddleware(
    new Request(`https://member.example${pathname}`),
    () =>
      new Response(
        renderToStaticMarkup(createElement(RouterContextProvider, { children: view, router })),
      ),
  ).then((response) => response.text());
};

const featuresMarkup = (copy: LandingCopy): string =>
  `<section class="mx-auto flex w-full max-w-wide flex-col gap-10 px-4 py-16"><h2 data-slot="heading" class="font-bold text-foreground text-lg leading-tight">${copy.features_title}</h2><ul class="flex flex-col gap-12"><li class="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-10"><div class="flex flex-col gap-2"><h3 data-slot="heading" class="font-bold text-foreground text-base leading-tight">${copy.feature_profile_title}</h3><p class="text-base leading-normal text-muted-foreground">${copy.feature_profile_body}</p></div><div><div aria-hidden="true" class="flex min-h-36 flex-col gap-3 rounded-lg border border-border bg-card p-4"><div class="flex items-center gap-3"><div class="size-14 shrink-0 rounded-full bg-secondary"></div><div class="flex w-full flex-col gap-2"><div class="h-2.5 w-2/3 rounded-sm bg-secondary"></div><div class="h-2.5 w-1/3 rounded-sm bg-muted"></div></div></div><div class="h-2.5 w-full rounded-sm bg-muted"></div><div class="h-2.5 w-4/5 rounded-sm bg-muted"></div></div></div></li><li class="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-10"><div class="flex flex-col gap-2 md:order-2"><h3 data-slot="heading" class="font-bold text-foreground text-base leading-tight">${copy.feature_search_title}</h3><p class="text-base leading-normal text-muted-foreground">${copy.feature_search_body}</p></div><div class="md:order-1"><div aria-hidden="true" class="flex min-h-36 flex-col gap-3 rounded-lg border border-border bg-card p-4"><div class="h-3 w-full rounded-sm bg-secondary"></div><div class="flex items-center gap-3"><div class="size-10 shrink-0 rounded-full bg-secondary"></div><div class="flex w-full flex-col gap-2"><div class="h-2.5 w-1/2 rounded-sm bg-secondary"></div><div class="h-2.5 w-3/4 rounded-sm bg-muted"></div></div></div><div class="flex items-center gap-3"><div class="size-10 shrink-0 rounded-full bg-secondary"></div><div class="flex w-full flex-col gap-2"><div class="h-2.5 w-2/5 rounded-sm bg-secondary"></div><div class="h-2.5 w-3/5 rounded-sm bg-muted"></div></div></div></div></div></li><li class="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-10"><div class="flex flex-col gap-2"><h3 data-slot="heading" class="font-bold text-foreground text-base leading-tight">${copy.feature_security_title}</h3><p class="text-base leading-normal text-muted-foreground">${copy.feature_security_body}</p></div><div><div aria-hidden="true" class="flex min-h-36 flex-col gap-3 rounded-lg border border-border bg-card p-4"><div class="h-2.5 w-1/2 rounded-sm bg-secondary"></div><div class="h-2.5 w-1/3 rounded-sm bg-muted"></div><div class="mt-2 h-8 w-28 rounded-md bg-secondary"></div></div></div></li></ul></section>`;

const closingMarkup = (copy: LandingCopy): string =>
  `<section class="mx-auto flex w-full max-w-page flex-col items-center gap-4 px-4 py-16 text-center"><h2 data-slot="heading" class="font-bold text-foreground text-lg leading-tight">${copy.closing_title}</h2><a href="/signup" data-slot="button-link" class="box-border inline-flex w-fit shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border text-center font-bold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:focus-indicator disabled:cursor-not-allowed px-4 py-3 text-lg leading-none border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover hover:text-primary-foreground disabled:border-primary/50 disabled:bg-primary/50 disabled:text-primary-foreground/50">${copy.signup_link}</a></section>`;

const englishCopy = {
  closing_title: "Let's get started",
  feature_profile_body: "Write your name and an introduction, and have your own page.",
  feature_profile_title: "Create a profile",
  feature_search_body: "Search by name and open the profile of someone you care about.",
  feature_search_title: "Find other members",
  feature_security_body: "Make login stronger with passkeys and two-factor authentication.",
  feature_security_title: "Protect your account",
  features_title: "What you can do",
  signup_link: "Sign up",
} as const satisfies LandingCopy;

const japaneseCopy = {
  closing_title: "さっそく始めましょう",
  feature_profile_body: "名前と自己紹介を書いて、自分のページを持てます。",
  feature_profile_title: "プロフィールを作る",
  feature_search_body: "名前で検索して、気になる人のプロフィールを開けます。",
  feature_search_title: "他の利用者を探す",
  feature_security_body: "パスキーと 2 段階認証で、ログインを強くできます。",
  feature_security_title: "アカウントを守る",
  features_title: "できること",
  signup_link: "新規登録",
} as const satisfies LandingCopy;

describe("landing features and closing in English", () => {
  const it = test
    .extend("catalog", () => landingCopy("en"))
    .extend("features", () => rendered("/en", createElement(Features)))
    .extend("closing", () => rendered("/en", createElement(Closing)));

  it("reads the English catalog", ({ catalog }) => {
    expect.hasAssertions();
    expect(catalog).toStrictEqual(englishCopy);
  });

  it("renders the English catalog", ({ features, closing }) => {
    expect.hasAssertions();
    expect(features).toBe(featuresMarkup(englishCopy));
    expect(closing).toBe(
      closingMarkup({ ...englishCopy, closing_title: "Let&#x27;s get started" }),
    );
  });
});

describe("landing features and closing in Japanese", () => {
  const it = test
    .extend("catalog", () => landingCopy("ja"))
    .extend("features", () => rendered("/", createElement(Features)))
    .extend("closing", () => rendered("/", createElement(Closing)));

  it("keeps the Japanese catalog", ({ catalog }) => {
    expect.hasAssertions();
    expect(catalog).toStrictEqual(japaneseCopy);
  });

  it("renders the Japanese catalog", ({ features, closing }) => {
    expect.hasAssertions();
    expect(features).toBe(featuresMarkup(japaneseCopy));
    expect(closing).toBe(closingMarkup(japaneseCopy));
  });
});
