import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { overwriteGetLocale, type Locale } from "#paraglide/runtime.js";
import { ProfilePreview } from "./profile-preview.tsx";

const renderedPreview = (locale: Locale): string => {
  overwriteGetLocale(() => locale);
  return renderToStaticMarkup(createElement(ProfilePreview));
};

const samplePreview = (caption: string): string =>
  `<figure class="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm"><figcaption class="px-5 py-2 text-sm leading-normal font-bold text-foreground">${caption}</figcaption><div aria-hidden="true" inert=""><div class="h-24 bg-secondary"></div><div class="flex flex-col gap-3 px-5 pb-5"><div class="-mt-10"><span data-slot="avatar" aria-hidden="true" class="inline-flex shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-secondary-foreground select-none size-20 text-2xl">山</span></div><div class="flex flex-col gap-1"><p class="text-xl leading-tight font-bold">山田 花子</p><p class="text-sm leading-normal text-muted-foreground">東京</p></div><p class="text-base leading-relaxed text-muted-foreground">週末は本屋めぐり。プロフィールで趣味と近況を書いています。</p><div class="flex flex-wrap gap-2"><span class="inline-flex w-fit items-center justify-center rounded-md border px-2 py-1.5 text-base leading-none font-bold border-primary bg-primary text-primary-foreground">フォロー</span><span class="inline-flex w-fit items-center justify-center rounded-md border px-2 py-1.5 text-base leading-none font-bold border-border bg-card text-foreground">メッセージ</span></div></div></div></figure>`;

describe("landing profile preview", () => {
  it("shows a sample caption and illustrates follow and message without actions", () => {
    expect.hasAssertions();
    try {
      expect(renderedPreview("ja")).toBe(samplePreview("プロフィールの見本"));
      expect(renderedPreview("en")).toBe(samplePreview("Sample profile"));
    } finally {
      overwriteGetLocale(() => "ja");
    }
  });
});
