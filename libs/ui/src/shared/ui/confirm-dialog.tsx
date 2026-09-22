import { KIND } from "baseui/button";
import { Modal, ModalBody, ModalButton, ModalFooter, ModalHeader, ROLE, SIZE } from "baseui/modal";

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

const ConfirmDialog = ({
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
  variant = "primary",
}: ConfirmDialogProps): ReactElement => {
  return (
    <Modal
      data-slot="confirm-dialog"
      isOpen={open}
      animate
      closeable
      role={ROLE.alertdialog}
      size={SIZE.default}
      onClose={() => {
        onOpenChange(false);
      }}
    >
      <ModalHeader>{title}</ModalHeader>
      <ModalBody>{description}</ModalBody>
      <ModalFooter>
        <ModalButton
          kind={KIND.tertiary}
          onClick={() => {
            onOpenChange(false);
          }}
        >
          キャンセル
        </ModalButton>
        <ModalButton
          kind={variant === "danger" ? KIND.dangerPrimary : KIND.primary}
          onClick={onConfirm}
        >
          {confirmLabel}
        </ModalButton>
      </ModalFooter>
    </Modal>
  );
};

export { ConfirmDialog };
