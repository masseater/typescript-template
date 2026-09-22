import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { CheckboxField } from "./checkbox-field.tsx";

describe("server rendered checkbox", () => {
  const it = test.extend("theServerRenderedCheckboxField", () =>
    renderToStaticMarkup(
      createElement(CheckboxField, {
        checked: false,
        label: "バックアップコードを保管しました",
        onCheckedChange: () => undefined,
      }),
    ));

  it("names the checkbox and points the label at a control before hydration", ({
    theServerRenderedCheckboxField,
  }) => {
    expect(theServerRenderedCheckboxField).toMatchInlineSnapshot(
      `"<label data-slot="field" class="flex w-fit cursor-pointer items-center gap-2"><label data-baseweb="checkbox" data-slot="checkbox" class=""><span class=""></span><input aria-label="バックアップコードを保管しました" type="checkbox" class=""/></label><span class="text-base leading-none font-bold text-foreground">バックアップコードを保管しました</span></label>"`,
    );
  });
});
