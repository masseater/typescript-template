import { Button, CheckboxField, ConfirmDialog, FormColumn, Page, StatusMessage } from "@repo/ui";

import { useLeaveForm } from "#pages/settings/model/leave-form.ts";
import { memberRetentionDays } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function LeavePage(): ReactElement {
  const form = useLeaveForm();
  const retentionMessage = `退会後 ${memberRetentionDays} 日間は、同じメールアドレスで復旧できます。`;
  const confirmDescription = form.immediate
    ? "アカウントと保存データをすぐに完全に削除します。"
    : `アカウントを退会します。${retentionMessage}`;
  return (
    <Page title="退会">
      <StatusMessage>{retentionMessage}</StatusMessage>
      <FormColumn>
        <CheckboxField
          checked={form.immediate}
          label="すぐに完全に削除する"
          onCheckedChange={(checked) => form.setImmediate(checked === true)}
        />
        <Button
          type="button"
          variant="primary"
          disabled={form.blocked}
          onClick={() => form.handleOpenChange(true)}
        >
          退会する
        </Button>
        {form.error.length > 0 ? <StatusMessage>{form.error}</StatusMessage> : null}
      </FormColumn>
      <ConfirmDialog
        open={form.confirming}
        title="退会しますか？"
        description={confirmDescription}
        confirmLabel="退会する"
        onConfirm={form.handleConfirm}
        onOpenChange={form.handleOpenChange}
      />
    </Page>
  );
}

export { LeavePage };
