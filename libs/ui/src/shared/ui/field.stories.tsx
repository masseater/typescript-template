import { Effect } from "effect";
import { noop } from "es-toolkit";
import { expect, waitFor } from "storybook/test";

import preview, { playTask } from "../../../storybook/preview";
import { Field } from "./field";
import { FieldValidationMessageProvider } from "./field-validation-message-provider";

import type { ReactElement } from "react";
import type { FieldValidationMessages } from "./field-validation-messages";

const meta = preview.meta({ args: { onValueChange: noop, value: "" }, component: Field });

export const TextField = meta.story({
  args: { label: "ユーザー名", name: "name", required: true },
});

export const Email = meta.story({
  args: {
    autoComplete: "username",
    label: "メールアドレス",
    name: "email",
    required: true,
    type: "email",
    value: "taro@example.com",
  },
});

export const Password = meta.story({
  args: {
    autoComplete: "current-password",
    label: "パスワード",
    name: "password",
    required: true,
    type: "password",
  },
});

export const ReadOnly = meta.story({
  args: { label: "所属", name: "team", readOnly: true, value: "プラットフォーム" },
});

export const Numeric = meta.story({
  args: {
    autoComplete: "one-time-code",
    inputMode: "numeric",
    label: "確認コード",
    maxLength: 6,
    name: "totp",
    pattern: "[0-9]{6}",
  },
});

export const Multiline = meta.story({
  args: {
    label: "認証アプリ登録用 URI",
    multiline: true,
    name: "totp-uri",
    readOnly: true,
    value: "otpauth://totp/template:taro@example.com?secret=JBSWY3DPEHPK3PXP&issuer=template",
  },
});

export const TooShort = meta.story({
  args: {
    label: "パスワード（12文字以上）",
    minLength: 12,
    name: "password",
    type: "password",
    value: undefined,
  },
  play: ({ canvas, canvasElement }) =>
    Effect.runPromise(
      Effect.gen(function* rejectShortPassword() {
        const { page, userEvent } = yield* playTask(() => import("vite-plus/test/browser/context"));
        const rendered = page.elementLocator(canvasElement);
        yield* playTask(() =>
          userEvent.fill(rendered.getByLabelText("パスワード（12文字以上）"), "short"),
        );
        yield* playTask(() => userEvent.tab());
        const shortPasswordIsRejected = (): Promise<void> =>
          expect(canvas.getByText("文字数が足りません。")).toBeInTheDocument();
        yield* playTask(() => waitFor(shortPasswordIsRejected));
      }),
    ),
});

export const Missing = meta.story({
  args: { label: "ユーザー名", name: "name", required: true, value: undefined },
  play: ({ canvas, canvasElement }) =>
    Effect.runPromise(
      Effect.gen(function* rejectEmptyName() {
        const { page, userEvent } = yield* playTask(() => import("vite-plus/test/browser/context"));
        const rendered = page.elementLocator(canvasElement);
        yield* playTask(() => userEvent.fill(rendered.getByLabelText("ユーザー名"), "x"));
        yield* playTask(() => userEvent.fill(rendered.getByLabelText("ユーザー名"), ""));
        yield* playTask(() => userEvent.tab());
        const emptyNameIsRejected = (): Promise<void> =>
          expect(canvas.getByText("入力してください。")).toBeInTheDocument();
        yield* playTask(() => waitFor(emptyNameIsRejected));
      }),
    ),
});

const englishFieldValidationMessages = {
  patternMismatch: "Follow the requested format.",
  tooLong: "Too many characters.",
  tooShort: "Not enough characters.",
  typeMismatch: "Enter a valid format.",
  valueMissing: "Enter a value.",
} as const satisfies FieldValidationMessages;

const withEnglishFieldValidation = (Story: () => ReactElement): ReactElement => (
  <FieldValidationMessageProvider messages={englishFieldValidationMessages}>
    <Story />
  </FieldValidationMessageProvider>
);

export const EnglishMissing = meta.story({
  args: { label: "ユーザー名", name: "name", required: true, value: undefined },
  decorators: [withEnglishFieldValidation],
  play: ({ canvas, canvasElement }) =>
    Effect.runPromise(
      Effect.gen(function* rejectEmptyEnglishName() {
        const { page, userEvent } = yield* playTask(() => import("vite-plus/test/browser/context"));
        const rendered = page.elementLocator(canvasElement);
        yield* playTask(() => userEvent.fill(rendered.getByLabelText("ユーザー名"), "x"));
        yield* playTask(() => userEvent.fill(rendered.getByLabelText("ユーザー名"), ""));
        yield* playTask(() => userEvent.tab());
        const emptyNameIsRejected = (): Promise<void> =>
          expect(canvas.getByText("Enter a value.")).toBeInTheDocument();
        yield* playTask(() => waitFor(emptyNameIsRejected));
      }),
    ),
});
