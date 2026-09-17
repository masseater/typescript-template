import { expect, screen, userEvent, waitFor } from "storybook/test";
import { Button } from "./button";
import type { ReactElement } from "react";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { ToastViewport } from "./toast-viewport";
import preview from "../../../.storybook/preview";
import { useCallback } from "react";
import { useToast } from "./use-toast";

function ShowToast({ variant }: Readonly<{ variant: "error" | "success" }>): ReactElement {
  const toast = useToast();
  const show = useCallback(() => {
    toast(
      variant,
      variant === "error" ? "利用者の権限を変更できませんでした。" : "利用者の権限を変更しました。",
    );
  }, [toast, variant]);
  return (
    <Button type="button" variant="primary" onClick={show}>
      通知を出す
    </Button>
  );
}

const meta = preview.meta({
  args: { variant: "success" },
  component: ShowToast,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "通知を出す" }));
  },
  render: ({ variant }): ReactElement => (
    <ToastPrimitive.Provider>
      <ShowToast variant={variant} />
      <ToastViewport />
    </ToastPrimitive.Provider>
  ),
  title: "shared/ui/ToastItem",
});

export const Success = meta.story({
  args: { variant: "success" },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "通知を出す" }));
    await expect(await screen.findByText("利用者の権限を変更しました。")).toBeInTheDocument();
  },
});

export const Failure = meta.story({
  args: { variant: "error" },
  parameters: { a11y: { test: "todo" } },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "通知を出す" }));
    await expect(
      await screen.findAllByText("利用者の権限を変更できませんでした。"),
    ).not.toHaveLength(0);
  },
});

export const Closes = meta.story({
  args: { variant: "success" },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "通知を出す" }));
    await userEvent.click(await screen.findByLabelText("通知を閉じる"));
    await waitFor(async () => {
      await expect(screen.queryByLabelText("通知を閉じる")).not.toBeInTheDocument();
    });
  },
});
