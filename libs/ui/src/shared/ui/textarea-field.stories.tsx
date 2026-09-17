import { expect, fn, userEvent } from "storybook/test";
import { TextareaField } from "./textarea-field";
import preview from "../../../.storybook/preview";

const meta = preview.meta({ args: { onValueChange: fn() }, component: TextareaField });

export const Default = meta.story({ args: { label: "備考", name: "note", value: "" } });

export const ReadOnly = meta.story({
  args: {
    label: "認証アプリ登録用 URI",
    name: "totp-uri",
    readOnly: true,
    value: "otpauth://totp/template:taro@example.com?secret=JBSWY3DPEHPK3PXP&issuer=template",
  },
});

export const Types = meta.story({
  args: { label: "備考", name: "note", value: "" },
  play: async ({ args, canvas }) => {
    await userEvent.type(canvas.getByLabelText("備考"), "確認しました");
    await expect(args.onValueChange).toHaveBeenCalled();
  },
});
