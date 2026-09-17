import { controlClassName, fieldClassName, labelClassName } from "./control";
import { expect, waitFor } from "storybook/test";
import { FieldErrors } from "./field-errors";
import { Field as FieldPrimitive } from "@base-ui/react/field";
import type { ReactElement } from "react";
import preview from "../../../.storybook/preview";

const meta = preview.meta({
  component: FieldErrors,
  render: (): ReactElement => (
    <FieldPrimitive.Root validationMode="onBlur" className={fieldClassName}>
      <FieldPrimitive.Label className={labelClassName}>ユーザー名</FieldPrimitive.Label>
      <FieldPrimitive.Control required maxLength={4} className={controlClassName} />
      <FieldErrors />
    </FieldPrimitive.Root>
  ),
});

export const Silent = meta.story();

export const Missing = meta.story({
  play: async ({ canvas, canvasElement }) => {
    const { page, userEvent } = await import("vite-plus/test/browser/context");
    const rendered = page.elementLocator(canvasElement);
    await userEvent.fill(rendered.getByLabelText("ユーザー名"), "x");
    await userEvent.fill(rendered.getByLabelText("ユーザー名"), "");
    await userEvent.tab();
    await waitFor(async () => {
      await expect(canvas.getByText("入力してください。")).toBeInTheDocument();
    });
  },
});
