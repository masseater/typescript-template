import { Effect } from "effect";
import { noop } from "es-toolkit";
import { expect } from "storybook/test";

import preview, { playTask } from "../../../../../storybook/preview";
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
        yield* playTask(() => expect(bounds.width).toBeGreaterThanOrEqual(24));
        yield* playTask(() => expect(bounds.height).toBeGreaterThanOrEqual(24));
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
        yield* playTask(() =>
          expect(
            checkbox.getAttribute("aria-checked") === "true" ||
              (checkbox as HTMLInputElement).checked,
          ).toBe(true),
        );
        yield* playTask(() => expect(bounds.width).toBeGreaterThanOrEqual(24));
        yield* playTask(() => expect(bounds.height).toBeGreaterThanOrEqual(24));
      }),
    ),
});
