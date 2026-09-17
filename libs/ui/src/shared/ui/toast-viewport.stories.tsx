import { expect, screen, userEvent } from "storybook/test";
import { Button } from "./button";
import type { ReactElement } from "react";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { ToastViewport } from "./toast-viewport";
import preview from "../../../.storybook/preview";
import { useToast } from "./use-toast";

function ShowToasts(): ReactElement {
  const toast = useToast();
  function show(): void {
    toast("success", "利用者の権限を変更しました。");
    toast("success", "確認メールを再送しました。");
  }
  return (
    <Button type="button" variant="primary" onClick={show}>
      通知を 2 件出す
    </Button>
  );
}

const meta = preview.meta({
  component: ToastViewport,
  render: (): ReactElement => (
    <ToastPrimitive.Provider>
      <ShowToasts />
      <ToastViewport />
    </ToastPrimitive.Provider>
  ),
});

export const Empty = meta.story();

export const Stacked = meta.story({
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "通知を 2 件出す" }));
    await expect(await screen.findByText("確認メールを再送しました。")).toBeInTheDocument();
  },
});
