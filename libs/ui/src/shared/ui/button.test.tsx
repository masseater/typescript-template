import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { Button } from "./button.tsx";

const SPACING_PX = 4;

describe("small button target size", () => {
  const it = test.extend("theSmallButtonTarget", () => {
    const markup = renderToStaticMarkup(
      <Button size="small" type="button">
        編集
      </Button>,
    );
    return [markup].map((rendered) => {
      const className = /<button\b[^>]*class="([^"]*)"/u.exec(rendered)?.[1];
      if (className === undefined) {
        throw new Error("missing button class");
      }
      const spacingPx = (utility: string): number => {
        const matched = new RegExp(String.raw`(?:^|\s)${utility}-(\d+(?:\.\d+)?)(?:\s|$)`).exec(
          className,
        );
        const units = matched?.[1];
        if (units === undefined) {
          throw new Error(`missing ${utility} on ${className}`);
        }
        return Number(units) * SPACING_PX;
      };
      const labelText = /(?:^|\s)(text-sm)(?:\s|$)/u.exec(className)?.[1];
      if (labelText === undefined) {
        throw new Error(`missing small label text on ${className}`);
      }
      return { heightPx: spacingPx("min-h"), labelText, widthPx: spacingPx("min-w") };
    });
  });

  it("gives the small control a 24px box and keeps the label at text-sm", ({
    theSmallButtonTarget,
  }) => {
    expect(theSmallButtonTarget).toStrictEqual([
      { heightPx: 24, labelText: "text-sm", widthPx: 24 },
    ]);
  });
});
