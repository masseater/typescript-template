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
  play: async ({ canvas }) => {
    const checkbox = canvas.getByRole("checkbox");
    const bounds = checkbox.getBoundingClientRect();
    await expect(bounds.width).toBeGreaterThanOrEqual(24);
    await expect(bounds.height).toBeGreaterThanOrEqual(24);
  },
});

export const Checked = meta.story({
  args: { checked: true },
  play: async ({ canvas }) => {
    const checkbox = canvas.getByRole("checkbox");
    const bounds = checkbox.getBoundingClientRect();
    const glyph = checkbox.querySelector("svg");
    if (!(glyph instanceof SVGSVGElement)) {
      throw new Error("checked checkbox is missing its glyph");
    }
    const glyphBounds = glyph.getBoundingClientRect();
    const controlFontPx = Number.parseFloat(getComputedStyle(checkbox).fontSize);
    await expect(
      bounds.width >= 24 &&
        bounds.height >= 24 &&
        glyphBounds.width < controlFontPx &&
        glyphBounds.height < controlFontPx,
    ).toBe(true);
  },
});
