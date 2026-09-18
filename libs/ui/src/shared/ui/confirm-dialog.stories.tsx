import { noop } from "es-toolkit";
import { expect, screen } from "storybook/test";

import preview from "../../../.storybook/preview";
import { ConfirmDialog } from "./confirm-dialog";

const meta = preview.meta({
  args: {
    confirmLabel: "削除する",
    description: "この利用者を削除します。削除した利用者は元に戻せません。",
    onConfirm: noop,
    onOpenChange: noop,
    title: "利用者を削除しますか？",
  },
  component: ConfirmDialog,
});

export const Closed = meta.story({ args: { open: false } });

export const Danger = meta.story({
  args: { open: true, variant: "danger" },
  play: async () => {
    await expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  },
});

export const Primary = meta.story({
  args: {
    confirmLabel: "送信する",
    description: "確認メールを再送します。",
    open: true,
    title: "確認メールを再送しますか？",
  },
});
