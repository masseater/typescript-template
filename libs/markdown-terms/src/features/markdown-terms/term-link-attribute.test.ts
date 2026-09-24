import { describe, expect, test } from "vite-plus/test";

import { termLinkAttribute } from "./term-link-attribute.ts";

describe("reading a term link attribute", () => {
  const it = test.extend("read", () => {
    const attributes = [
      { name: "term", type: "mdxJsxAttribute", value: "利用者" },
      { name: "label", type: "mdxJsxAttribute", value: { type: "mdxJsxAttributeValueExpression" } },
      { name: "label", type: "mdxJsxExpressionAttribute", value: "式" },
    ];
    return (["term", "label"] as const).map((attributeName) =>
      termLinkAttribute(attributes, attributeName),
    );
  });

  it("returns only string values of plain attributes", ({ read }) => {
    expect(read).toStrictEqual(["利用者", undefined]);
  });
});
