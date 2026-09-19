import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";

import { Button } from "./button";

import type { ReactElement } from "react";

type ConfirmDialogProps = {
  readonly confirmLabel: string;
  readonly description: string;
  readonly onConfirm: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly title: string;
  readonly variant?: "danger" | "primary" | undefined;
};

const ConfirmDialogPopup = ({
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  title,
  variant = "primary",
}: ConfirmDialogProps): ReactElement => {
  const cancel = (): void => {
    onOpenChange(false);
  };
  return (
    <AlertDialogPrimitive.Popup
      data-slot="confirm-dialog"
      className="fixed top-1/2 left-1/2 z-50 flex w-full max-w-column -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg outline-none"
    >
      <AlertDialogPrimitive.Title className="text-lg leading-tight font-bold text-foreground">
        {title}
      </AlertDialogPrimitive.Title>
      <AlertDialogPrimitive.Description className="text-base leading-normal text-foreground">
        {description}
      </AlertDialogPrimitive.Description>
      <div className="flex justify-end gap-2">
        <Button type="button" onClick={cancel}>
          キャンセル
        </Button>
        <Button type="button" variant={variant} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </AlertDialogPrimitive.Popup>
  );
};

export { ConfirmDialogPopup };
export type { ConfirmDialogProps };
