import {
  Button,
  Field,
  FormColumn,
  Heading,
  Page,
  STATUS_VARIANT,
  StatusMessage,
  formatWarekiDateTime,
} from "@repo/ui";

import { DataTable } from "#shared/ui/data-table.tsx";

import type { AuditFilterForm } from "#pages/audit/model/audit-filter.ts";
import type { StaffAuditPageView } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

function AuditView({
  audit,
  error,
  page,
}: Readonly<{
  audit: AuditFilterForm;
  error: string | undefined;
  page: StaffAuditPageView | undefined;
}>): ReactElement {
  const {
    action,
    actorId,
    handleActionChange,
    handleActorIdChange,
    handleSubmit,
    handleTargetIdChange,
    targetId,
  } = audit;
  return (
    <Page title="監査ログ">
      <form onSubmit={handleSubmit}>
        <FormColumn>
          <Field
            label="操作者 ID"
            name="actorId"
            onValueChange={handleActorIdChange}
            value={actorId}
          />
          <Field
            label="対象 ID"
            name="targetId"
            onValueChange={handleTargetIdChange}
            value={targetId}
          />
          <Field label="操作" name="action" onValueChange={handleActionChange} value={action} />
          <Button type="submit">絞り込む</Button>
        </FormColumn>
      </form>
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
      {page === undefined && error === undefined && (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      )}
      {page !== undefined && page.events.length === 0 && (
        <StatusMessage variant={STATUS_VARIANT.empty}>監査ログはまだありません。</StatusMessage>
      )}
      {page !== undefined && page.events.length > 0 && (
        <section aria-label="監査ログ一覧">
          <Heading as="h2" size="section">
            一覧
          </Heading>
          <p className="text-sm text-muted-foreground">全 {page.total} 件</p>
          <DataTable
            columns={["日時", "操作", "操作者 ID", "対象 ID"]}
            label="監査ログ一覧"
            rows={page.events.map((event) => (
              <tr key={event.id} className="border-b border-border">
                <td className="p-2">{formatWarekiDateTime(event.createdAt.getTime())}</td>
                <td className="p-2">{event.action}</td>
                <td className="p-2">{event.actorId}</td>
                <td className="p-2">{event.targetId}</td>
              </tr>
            ))}
          />
        </section>
      )}
    </Page>
  );
}

export { AuditView };
