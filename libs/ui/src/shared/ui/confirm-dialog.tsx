import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { ConfirmDialogPopup } from "./confirm-dialog-popup";
import type { ConfirmDialogProps } from "./confirm-dialog-popup";
import type { ReactElement } from "react";

function ConfirmDialog(props: ConfirmDialogProps): ReactElement {
  const { confirmLabel, description, onConfirm, onOpenChange, open, title, variant } = props;
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Backdrop
          data-slot="confirm-dialog-backdrop"
          className="fixed inset-0 z-50 bg-scrim"
        />
        <ConfirmDialogPopup
          confirmLabel={confirmLabel}
          description={description}
          onConfirm={onConfirm}
          onOpenChange={onOpenChange}
          open={open}
          title={title}
          variant={variant}
        />
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

export { ConfirmDialog };
