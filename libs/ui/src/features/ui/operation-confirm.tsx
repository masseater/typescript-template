import { ConfirmDialog } from "./shared/ui/confirm-dialog";

import type { ReactElement } from "react";

type Confirmation = Readonly<{
  confirmLabel: string;
  description: string;
  title: string;
  variant: "danger" | "primary";
}>;

const OperationConfirm = <Operation,>({
  confirming,
  describe,
  onConfirm,
  onOpenChange,
}: Readonly<{
  confirming: Operation | undefined;
  describe: (operation: Operation) => Confirmation;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}>): ReactElement | null => {
  if (confirming === undefined) {
    return null;
  }
  const confirmation = describe(confirming);
  return (
    <ConfirmDialog
      open
      confirmLabel={confirmation.confirmLabel}
      description={confirmation.description}
      title={confirmation.title}
      onOpenChange={onOpenChange}
      variant={confirmation.variant}
      onConfirm={onConfirm}
    />
  );
};

export { OperationConfirm };
export type { Confirmation };
