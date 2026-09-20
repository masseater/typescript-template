import { Button, Field, FormColumn, Heading, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useEffect, useState } from "react";

import { loadAuditPage } from "#pages/audit/api/audit.ts";

import type { StaffAuditPageView } from "#shared/contracts/index.ts";
import type { ReactElement, SubmitEventHandler } from "react";

const createdAtLabel = new Intl.DateTimeFormat("ja", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function AuditPage(): ReactElement {
  const [page, setPage] = useState<StaffAuditPageView | undefined>();
  const [actorId, setActorId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [action, setAction] = useState("");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    void loadAuditPage({ limit: 50, offset: 0 })
      .then((loaded) => {
        if (active) {
          setPage(loaded);
        }
      })
      .catch((failure: unknown) => {
        if (active) {
          setError(failure instanceof Error ? failure.message : "監査ログを読めませんでした。");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function handleFilter(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    setError(undefined);
    void loadAuditPage({
      action: action.length > 0 ? action : undefined,
      actorId: actorId.length > 0 ? actorId : undefined,
      limit: 50,
      offset: 0,
      targetId: targetId.length > 0 ? targetId : undefined,
    })
      .then(setPage)
      .catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : "監査ログを読めませんでした。");
      });
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        監査ログ
      </Heading>
      <form onSubmit={handleFilter as SubmitEventHandler<HTMLFormElement>}>
        <FormColumn>
          <Field label="操作者 ID" name="actorId" onChange={setActorId} value={actorId} />
          <Field label="対象 ID" name="targetId" onChange={setTargetId} value={targetId} />
          <Field label="操作" name="action" onChange={setAction} value={action} />
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
          <Heading as="h2" id="audit-log-heading" size="section">
            一覧
          </Heading>
          <p className="text-sm text-muted-foreground">全 {page.total} 件</p>
          <table
            aria-labelledby="audit-log-heading"
            className="w-full border-collapse text-left text-sm"
          >
            <thead>
              <tr className="border-b border-border">
                <th className="p-2">日時</th>
                <th className="p-2">操作</th>
                <th className="p-2">操作者 ID</th>
                <th className="p-2">対象 ID</th>
              </tr>
            </thead>
            <tbody>
              {page.events.map((event) => (
                <tr key={event.id} className="border-b border-border">
                  <td className="p-2">{createdAtLabel.format(event.createdAt)}</td>
                  <td className="p-2">{event.action}</td>
                  <td className="p-2">{event.actorId}</td>
                  <td className="p-2">{event.targetId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

export { AuditPage };
