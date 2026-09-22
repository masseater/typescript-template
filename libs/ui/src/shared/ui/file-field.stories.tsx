import { Effect } from "effect";
import { noop } from "es-toolkit";
import { expect, fn, userEvent } from "storybook/test";

import preview, { playTask } from "../../../storybook/preview";
import { FileField } from "./file-field";

const meta = preview.meta({
  args: {
    accept: "image/jpeg,image/png,image/webp",
    label: "顔写真",
    name: "face",
    onFileChange: noop,
  },
  component: FileField,
});

export const Default = meta.story();

export const WithHint = meta.story({ args: { hint: "JPEG・PNG・WebP、5 MB まで。" } });

export const Disabled = meta.story({ args: { disabled: true } });

export const Picks = meta.story({
  args: { onFileChange: fn() },
  play: ({ args, canvas }) =>
    Effect.runPromise(
      Effect.gen(function* pickFile() {
        const picked = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "me.jpg", {
          type: "image/jpeg",
        });
        yield* playTask(() => userEvent.upload(canvas.getByLabelText("顔写真"), picked));
        yield* playTask(() => expect(args.onFileChange).toHaveBeenCalledWith(picked));
      }),
    ),
});
