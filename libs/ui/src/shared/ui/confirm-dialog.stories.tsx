import { expect, screen } from "storybook/test";
import { ConfirmDialog } from "./confirm-dialog";
import { noop } from "es-toolkit";
import preview from "../../../.storybook/preview";

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

const Closed = meta.story({ args: { open: false } });

const Danger = meta.story({
  args: { open: true, variant: "danger" },
  play: async () => {
    await expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  },
});

const Primary = meta.story({
  args: {
    confirmLabel: "送信する",
    description: "確認メールを再送します。",
    open: true,
    title: "確認メールを再送しますか？",
  },
});

export { Closed, Danger, Primary };
