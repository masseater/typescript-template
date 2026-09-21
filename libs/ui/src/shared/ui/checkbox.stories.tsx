import { Effect } from "effect";
import { noop } from "es-toolkit";
import { expect } from "storybook/test";

import preview from "../../../storybook/preview";
import { Checkbox } from "./checkbox";

const meta = preview.meta({
  args: { "aria-label": "通知を受け取る", onCheckedChange: noop },
  component: Checkbox,
});

export const Unchecked = meta.story({
  args: { checked: false },
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* measureUncheckedCheckbox() {
        const checkbox = canvas.getByRole("checkbox");
        const bounds = checkbox.getBoundingClientRect();
        yield* Effect.promise(() => expect(bounds.width).toBeGreaterThanOrEqual(24));
        yield* Effect.promise(() => expect(bounds.height).toBeGreaterThanOrEqual(24));
      }),
    ),
});

export const Checked = meta.story({
  args: { checked: true },
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* measureCheckedCheckbox() {
        const checkbox = canvas.getByRole("checkbox");
        const bounds = checkbox.getBoundingClientRect();
        const glyph = checkbox.querySelector("svg");
        if (!(glyph instanceof SVGSVGElement)) {
          return yield* Effect.die("checked checkbox is missing its glyph");
        }
        const glyphBounds = glyph.getBoundingClientRect();
        const controlFontPx = Number.parseFloat(getComputedStyle(checkbox).fontSize);
        yield* Effect.promise(() =>
          expect(
            bounds.width >= 24 &&
              bounds.height >= 24 &&
              glyphBounds.width < controlFontPx &&
              glyphBounds.height < controlFontPx,
          ).toBe(true),
        );
      }),
    ),
});
