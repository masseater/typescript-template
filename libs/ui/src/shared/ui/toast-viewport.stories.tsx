import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { Effect } from "effect";
import { expect, screen, userEvent } from "storybook/test";

import preview, { playTask } from "../../../storybook/preview";
import { Button } from "./button";
import { ToastViewport } from "./toast-viewport";
import { useToast } from "./use-toast";

import type { ReactElement } from "react";

const ShowToasts = (): ReactElement => {
  const toast = useToast();
  const show = (): void => {
    toast("success", "利用者の権限を変更しました。");
    toast("success", "確認メールを再送しました。");
  };
  return (
    <Button type="button" variant="primary" onClick={show}>
      通知を 2 件出す
    </Button>
  );
};

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
  parameters: { a11y: { config: { rules: [{ enabled: false, id: "aria-hidden-focus" }] } } },
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* showTwoToasts() {
        yield* playTask(() =>
          userEvent.click(canvas.getByRole("button", { name: "通知を 2 件出す" })),
        );
        const toast = yield* playTask(() => screen.findByText("確認メールを再送しました。"));
        yield* playTask(() => expect(toast).toBeInTheDocument());
      }),
    ),
});
