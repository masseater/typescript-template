import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { Checkbox } from "./checkbox.tsx";

const SPACING_PX = 4;

describe("checkbox target size", () => {
  const it = test.extend("theCheckboxTarget", () => {
    const spacingPx = (className: string, utility: string): number => {
      const matched = new RegExp(String.raw`(?:^|[\s:])${utility}-(\d+(?:\.\d+)?)(?:\s|$)`).exec(
        className,
      );
      const units = matched?.[1];
      if (units === undefined) {
        throw new Error(`missing ${utility} on ${className}`);
      }
      return Number(units) * SPACING_PX;
    };
    const classNamed = (markup: string, marker: string): string => {
      const tags = markup.match(/<[^>]+>/gu) ?? [];
      const tag = tags.find((candidate) => candidate.includes(marker));
      const className = tag === undefined ? undefined : /class="([^"]*)"/u.exec(tag)?.[1];
      if (className === undefined) {
        throw new Error(`missing class for ${marker}`);
      }
      return className;
    };
    const markup = renderToStaticMarkup(
      createElement(Checkbox, {
        "aria-label": "通知を受け取る",
        checked: true,
        onCheckedChange: () => undefined,
      }),
    );
    return [markup].map((rendered) => ({
      boxPx: spacingPx(classNamed(rendered, 'role="checkbox"'), "size"),
      glyphPx: spacingPx(classNamed(rendered, "checkbox-indicator"), "size"),
    }));
  });

  it("gives the control a 24px box and a 12px check", ({ theCheckboxTarget }) => {
    expect(theCheckboxTarget).toStrictEqual([{ boxPx: 24, glyphPx: 12 }]);
  });
});
