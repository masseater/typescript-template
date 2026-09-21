import { Effect } from "effect";
import { noop } from "es-toolkit";
import { expect, fn, userEvent } from "storybook/test";

import preview, { playTask } from "../../../storybook/preview";
import { CheckboxField } from "./checkbox-field";

const meta = preview.meta({
  args: { label: "バックアップコードを保管しました", onCheckedChange: noop },
  component: CheckboxField,
});

export const Unchecked = meta.story({ args: { checked: false } });

export const Checked = meta.story({ args: { checked: true } });

export const Toggles = meta.story({
  args: { checked: false, onCheckedChange: fn() },
  play: ({ args, canvas }) =>
    Effect.runPromise(
      Effect.gen(function* toggleCheckbox() {
        yield* playTask(() => userEvent.click(canvas.getByRole("checkbox")));
        yield* playTask(() =>
          expect(args.onCheckedChange).toHaveBeenCalledWith(true, expect.anything()),
        );
      }),
    ),
});
