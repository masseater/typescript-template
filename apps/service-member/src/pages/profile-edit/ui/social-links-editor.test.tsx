import { AppProviders } from "@repo/ui/shell";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { maximumSocialLinks } from "#shared/contracts/index.ts";
import { SocialLinksEditor } from "./social-links-editor.tsx";

import type { SocialLinkField } from "#pages/profile-edit/model/social-link-field.ts";

const validationMessages = {
  patternMismatch: "形式が違います。",
  tooLong: "長すぎます。",
  tooShort: "短すぎます。",
  typeMismatch: "種類が違います。",
  valueMissing: "入力してください。",
} as const;

const invalidMessage = "https で始まる URL を入力してください。";

function rendered(values: readonly SocialLinkField[], errors: readonly unknown[] = []): string {
  return renderToStaticMarkup(
    <AppProviders fieldValidationMessages={validationMessages}>
      <SocialLinksEditor errors={errors} onChange={() => undefined} values={values} />
    </AppProviders>,
  );
}

describe("social links editor", () => {
  it("numbers each URL field and gives it a delete button", () => {
    expect.hasAssertions();
    const html = rendered([
      { id: "a", url: "" },
      { id: "b", url: "https://github.com/octocat" },
    ]);
    expect(html).toContain('name="socialLink-a"');
    expect(html).toContain('name="socialLink-b"');
    expect(html).toContain('aria-label="URL 1 を削除"');
    expect(html).toContain('aria-label="URL 2 を削除"');
    expect(html).toContain('value="https://github.com/octocat"');
    expect(html).toContain("<svg");
    expect(html).not.toContain(invalidMessage);
  });

  it("asks for https when a URL is not https", () => {
    expect.hasAssertions();
    expect(rendered([{ id: "a", url: "http://example.com/me" }])).toContain(invalidMessage);
  });

  it("shows the first submit error for the links", () => {
    expect.hasAssertions();
    expect(rendered([{ id: "a", url: "" }], [{ message: "URL が多すぎます。" }])).toContain(
      "URL が多すぎます。",
    );
  });

  it("stops offering to add once the limit is reached", () => {
    expect.hasAssertions();
    expect(rendered([{ id: "a", url: "" }])).toContain("URL を追加");
    const full = Array.from({ length: maximumSocialLinks }, (_, index) => ({
      id: `link-${String(index)}`,
      url: "",
    }));
    expect(rendered(full)).not.toContain("URL を追加");
  });
});
