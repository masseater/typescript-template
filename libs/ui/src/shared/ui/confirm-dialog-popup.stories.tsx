import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { noop } from "es-toolkit";

import preview from "../../../.storybook/preview";
import { ConfirmDialogPopup } from "./confirm-dialog-popup";

import type { ReactElement } from "react";

const meta = preview.meta({
  args: {
    confirmLabel: "削除する",
    description: "この利用者を削除します。削除した利用者は元に戻せません。",
    onConfirm: noop,
    onOpenChange: noop,
    open: true,
    title: "利用者を削除しますか？",
  },
  component: ConfirmDialogPopup,
  render: ({
    confirmLabel,
    description,
    onConfirm: handleConfirm,
    onOpenChange: handleOpenChange,
    open,
    title,
    variant,
  }): ReactElement => (
    <AlertDialogPrimitive.Root open={open}>
      <AlertDialogPrimitive.Portal>
        <ConfirmDialogPopup
          confirmLabel={confirmLabel}
          description={description}
          onConfirm={handleConfirm}
          onOpenChange={handleOpenChange}
          open={open}
          title={title}
          variant={variant ?? "primary"}
        />
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  ),
});

export const Primary = meta.story();

export const Danger = meta.story({ args: { variant: "danger" } });
