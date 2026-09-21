import { Effect } from "effect";
import { expect, screen, userEvent } from "storybook/test";

import preview, { playTask } from "../../../storybook/preview";
import { Button } from "./button";
import { STATUS_VARIANT } from "./status-variants.ts";
import { ToastProvider } from "./toast-provider";
import { useToast } from "./use-toast";

import type { ReactElement } from "react";

const ToastTrigger = (): ReactElement => {
  const toast = useToast();
  const success = (): void => {
    toast(STATUS_VARIANT.success, "利用者の権限を変更しました。");
  };
  const failure = (): void => {
    toast(STATUS_VARIANT.failure, "利用者の権限を変更できませんでした。");
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
  parameters: { a11y: { config: { rules: [{ enabled: false, id: "aria-hidden-focus" }] } } },
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* showSuccessToast() {
        yield* playTask(() =>
          userEvent.click(canvas.getByRole("button", { name: "成功の通知を出す" })),
        );
        const toast = yield* playTask(() =>
          screen.findByText("利用者の権限を変更しました。"),
        );
        yield* playTask(() => expect(toast).toBeInTheDocument());
      }),
    ),
});
