import { expect, screen, userEvent } from "storybook/test";

import preview from "../../../.storybook/preview";
import { Button } from "./button";
import { ToastProvider } from "./toast-provider";
import { useToast } from "./use-toast";

import type { ReactElement } from "react";

const ToastTrigger = (): ReactElement => {
  const toast = useToast();
  const success = (): void => {
    toast("success", "利用者の権限を変更しました。");
  };
  const failure = (): void => {
    toast("error", "利用者の権限を変更できませんでした。");
  };
  return (
    <div className="flex gap-2">
      <Button type="button" variant="primary" onClick={success}>
        成功の通知を出す
      </Button>
      <Button type="button" variant="danger" onClick={failure}>
        失敗の通知を出す
      </Button>
    </div>
  );
};

const meta = preview.meta({ args: { children: <ToastTrigger /> }, component: ToastProvider });

export const Default = meta.story();

export const Success = meta.story({
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "成功の通知を出す" }));
    await expect(await screen.findByText("利用者の権限を変更しました。")).toBeInTheDocument();
  },
});
