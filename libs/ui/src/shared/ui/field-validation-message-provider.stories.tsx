import { expect, waitFor } from "storybook/test";

import preview from "../../../storybook/preview";
import { Field } from "./field";
import { FieldValidationMessageProvider } from "./field-validation-message-provider";

import type { FieldValidationMessages } from "./field-validation-messages";

const englishMessages = {
  patternMismatch: "Follow the requested format.",
  tooLong: "Too many characters.",
  tooShort: "Not enough characters.",
  typeMismatch: "Enter a valid format.",
  valueMissing: "Enter a value.",
} as const satisfies FieldValidationMessages;

const meta = preview.meta({
  args: {
    children: <Field label="ユーザー名" name="name" required value="" />,
    messages: englishMessages,
  },
  component: FieldValidationMessageProvider,
});

export const Default = meta.story();

export const EnglishMissing = meta.story({
  args: {
    children: <Field label="ユーザー名" name="name" required value={undefined} />,
    messages: englishMessages,
  },
  play: async ({ canvas, canvasElement }) => {
    const { page, userEvent } = await import("vite-plus/test/browser/context");
    const rendered = page.elementLocator(canvasElement);
    await userEvent.fill(rendered.getByLabelText("ユーザー名"), "x");
    await userEvent.fill(rendered.getByLabelText("ユーザー名"), "");
    await userEvent.tab();
    await waitFor(async () => {
      await expect(canvas.getByText("Enter a value.")).toBeInTheDocument();
    });
  },
});
