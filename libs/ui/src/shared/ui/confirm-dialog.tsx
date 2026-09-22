import { KIND } from "baseui/button";
import { Modal, ModalBody, ModalButton, ModalFooter, ModalHeader, ROLE, SIZE } from "baseui/modal";

import type { ReactElement } from "react";

const cancelLabel = "キャンセル";

const ConfirmDialog = ({
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
  variant = "primary",
}: Readonly<{
  confirmLabel: string;
  description: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
  variant?: "danger" | "primary" | undefined;
}>): ReactElement => {
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
          {cancelLabel}
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
