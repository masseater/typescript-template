import { noop } from "es-toolkit";

import preview from "../../../../../storybook/preview";
import { Field } from "./field";
import { FieldValidationMessageProvider } from "./field-validation-message-provider";

import type { ReactElement } from "react";

const SuppliedField = (): ReactElement => {
  return <Field label="ユーザー名" name="name" required value="" onValueChange={noop} />;
};

const meta = preview.meta({
  args: {
    children: <SuppliedField />,
    messages: {
      patternMismatch: "指定された形式で入力してください。",
      tooLong: "文字数が多すぎます。",
      tooShort: "文字数が足りません。",
      typeMismatch: "正しい形式で入力してください。",
      valueMissing: "入力してください。",
    },
  },
  component: FieldValidationMessageProvider,
});

export const Default = meta.story();
