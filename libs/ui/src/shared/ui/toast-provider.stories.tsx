import { expect, screen, userEvent } from "storybook/test";
import { Button } from "./button";
import type { ReactElement } from "react";
import { ToastProvider } from "./toast-provider";
import preview from "../../../.storybook/preview";
import { useCallback } from "react";
import { useToast } from "./use-toast";

function ToastTrigger(): ReactElement {
  const toast = useToast();
  const success = useCallback(() => {
    toast("success", "利用者の権限を変更しました。");
  }, [toast]);
  const failure = useCallback(() => {
    toast("error", "利用者の権限を変更できませんでした。");
  }, [toast]);
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
}

const meta = preview.meta({ args: { children: <ToastTrigger /> }, component: ToastProvider });

const Default = meta.story();

const Success = meta.story({
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "成功の通知を出す" }));
    await expect(await screen.findByText("利用者の権限を変更しました。")).toBeInTheDocument();
  },
});

export { Default, Success };
