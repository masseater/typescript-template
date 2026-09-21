import {
  Button,
  Field,
  FormColumn,
  Heading,
  STATUS_VARIANT,
  StatusMessage,
  resultError,
} from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { useAuditList } from "#pages/audit/model/audit-list.ts";
import { DataTable } from "#shared/ui/data-table.tsx";

import type { ReactElement } from "react";

const createdAtLabel = new Intl.DateTimeFormat("ja", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function AuditPage(): ReactElement {
  const {
    action,
    actorId,
    handleActionChange,
    handleActorIdChange,
    handleSubmit,
    handleTargetIdChange,
    listing,
    targetId,
  } = useAuditList();
  const error = resultError(listing);
  const page = AsyncResult.isSuccess(listing) ? listing.value : undefined;

  return (
    <main className="flex flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        監査ログ
      </Heading>
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
        <StatusMessage variant={STATUS_VARIANT.pending}>監査ログはまだありません。</StatusMessage>
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
                <td className="p-2">{createdAtLabel.format(event.createdAt)}</td>
                <td className="p-2">{event.action}</td>
                <td className="p-2">{event.actorId}</td>
                <td className="p-2">{event.targetId}</td>
              </tr>
            ))}
          />
        </section>
      )}
    </main>
  );
}

export { AuditPage };
