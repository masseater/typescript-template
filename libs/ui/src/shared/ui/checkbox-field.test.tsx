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
      `"<div data-slot="field" class="flex w-fit items-center gap-2"><span data-unchecked="" role="checkbox" tabindex="0" id="base-ui-_R_3_" aria-checked="false" data-slot="checkbox" aria-label="バックアップコードを保管しました" class="box-border flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-input bg-card outline-none focus-visible:focus-indicator-outer disabled:cursor-not-allowed disabled:border-border/50 disabled:bg-card-hover data-invalid:border-destructive data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground"></span><input id="base-ui-_R_0_" style="clip-path:inset(50%);overflow:hidden;white-space:nowrap;border:0;padding:0;width:1px;height:1px;margin:-1px;position:fixed;top:0;left:0" tabindex="-1" type="checkbox" aria-hidden="true"/><label id="base-ui-_R_5_" for="base-ui-_R_0_" class="cursor-pointer inline-flex w-fit items-center gap-1 text-base leading-tight font-bold text-foreground select-none">バックアップコードを保管しました</label></div>"`,
    );
  });
});
