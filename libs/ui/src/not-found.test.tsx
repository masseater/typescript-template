import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { NotFoundPage } from "./not-found.tsx";

describe("存在しないページ", () => {
  const it = test.extend("theNotFoundPage", () =>
    renderToStaticMarkup(createElement(NotFoundPage)));

  it("ページが見つからないことを伝える", ({ theNotFoundPage }) => {
    expect.hasAssertions();
    expect(theNotFoundPage).toBe("<p>ページが見つかりません。</p>");
  });
});
