import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { expect, screen, userEvent, waitFor } from "storybook/test";

import preview from "../../../storybook/preview";
import { Button } from "./button";
import { STATUS_VARIANT } from "./status-variants.ts";
import { ToastItem } from "./toast-item";
import { ToastViewport } from "./toast-viewport";
import { useToast } from "./use-toast";

import type { ReactElement } from "react";

const Raise = ({
  title,
  variant,
}: Readonly<{
  title: string;
  variant: (typeof STATUS_VARIANT)[keyof Omit<typeof STATUS_VARIANT, "info" | "pending">];
}>): ReactElement => {
  const raise = useToast();
  const show = (): void => {
    raise(variant, title);
  };
  return (
    <Button type="button" variant="primary" onClick={show}>
      通知を出す
    </Button>
  );
};

const meta = preview.meta({
  args: { toast: { id: "toast_01", title: "利用者の権限を変更しました。", type: "success" } },
  component: ToastItem,
  render: ({ toast }): ReactElement => (
    <ToastPrimitive.Provider>
      <Raise
        title={typeof toast.title === "string" ? toast.title : ""}
        variant={
          toast.type === STATUS_VARIANT.failure ? STATUS_VARIANT.failure : STATUS_VARIANT.success
        }
      />
      <ToastViewport />
    </ToastPrimitive.Provider>
  ),
});

export const Success = meta.story({
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "通知を出す" }));
    await expect(await screen.findByText("利用者の権限を変更しました。")).toBeInTheDocument();
  },
});

export const Failure = meta.story({
  args: {
    toast: { id: "toast_02", title: "利用者の権限を変更できませんでした。", type: "error" },
  },
  parameters: { a11y: { config: { rules: [{ enabled: false, id: "aria-hidden-focus" }] } } },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "通知を出す" }));
    await expect(
      await screen.findAllByText("利用者の権限を変更できませんでした。"),
    ).not.toHaveLength(0);
  },
});

export const Closes = meta.story({
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "通知を出す" }));
    await userEvent.click(await screen.findByLabelText("通知を閉じる"));
    await waitFor(async () => {
      await expect(screen.queryByLabelText("通知を閉じる")).not.toBeInTheDocument();
    });
  },
});
