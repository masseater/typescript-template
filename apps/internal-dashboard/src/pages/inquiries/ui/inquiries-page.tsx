import { ROLE } from "@repo/config";
import { Button, Field, FormColumn, Heading, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useEffect, useState } from "react";

import {
  loadInquiry,
  loadInquiryCounts,
  loadMemberInquiries,
} from "#pages/inquiries/api/inquiries.ts";

import type { StaffInquiryCountsView, StaffInquiryThreadView } from "#shared/contracts/index.ts";
import type { StaffInquiryList } from "#shared/contracts/index.ts";
import type { ReactElement, SubmitEventHandler } from "react";

const createdAtLabel = new Intl.DateTimeFormat("ja", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function InquiriesPage(): ReactElement {
  const [counts, setCounts] = useState<StaffInquiryCountsView | undefined>();
  const [memberId, setMemberId] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [memberInquiries, setMemberInquiries] = useState<
    (typeof StaffInquiryList.Type)["inquiries"] | undefined
  >();
  const [selected, setSelected] = useState<StaffInquiryThreadView | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    void loadInquiryCounts()
      .then((loaded) => {
        if (active) {
          setCounts(loaded);
        }
      })
      .catch((failure: unknown) => {
        if (active) {
          setError(failure instanceof Error ? failure.message : "集計を読めませんでした。");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function handleMemberLookup(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    setError(undefined);
    setSelected(undefined);
    void loadMemberInquiries(memberId)
      .then((list) => {
        setMemberInquiries(list.inquiries);
      })
      .catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : "問い合わせを読めませんでした。");
      });
  }

  function handleInquiryLookup(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    setError(undefined);
    void loadInquiry(lookupId)
      .then((thread) => {
        setSelected(thread);
      })
      .catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : "問い合わせを読めませんでした。");
      });
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        問い合わせ
      </Heading>
      <p className="text-base leading-normal text-muted-foreground">
        読むだけの画面です。返信は管理者アプリで行います。
      </p>
      {counts === undefined && error === undefined && (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      )}
      {counts !== undefined && (
        <section aria-label="件数" className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-lg border border-border bg-card p-3">
            <p className="text-sm leading-tight text-muted-foreground">受付</p>
            <Heading as="h2" size="section">
              {counts.byStatus.open}
            </Heading>
          </article>
          <article className="rounded-lg border border-border bg-card p-3">
            <p className="text-sm leading-tight text-muted-foreground">対応中</p>
            <Heading as="h2" size="section">
              {counts.byStatus.answered}
            </Heading>
          </article>
          <article className="rounded-lg border border-border bg-card p-3">
            <p className="text-sm leading-tight text-muted-foreground">完了</p>
            <Heading as="h2" size="section">
              {counts.byStatus.closed}
            </Heading>
          </article>
        </section>
      )}
      {counts !== undefined && counts.trend.length > 0 && (
        <section aria-label="推移">
          <Heading as="h2" id="inquiry-trend-heading" size="section">
            直近 30 日の推移
          </Heading>
          <table
            aria-labelledby="inquiry-trend-heading"
            className="w-full border-collapse text-left text-sm"
          >
            <thead>
              <tr className="border-b border-border">
                <th className="p-2">日付</th>
                <th className="p-2">受付</th>
                <th className="p-2">対応中</th>
                <th className="p-2">完了</th>
              </tr>
            </thead>
            <tbody>
              {counts.trend.map((row) => (
                <tr key={row.day} className="border-b border-border">
                  <td className="p-2">{row.day}</td>
                  <td className="p-2">{row.open}</td>
                  <td className="p-2">{row.answered}</td>
                  <td className="p-2">{row.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <form onSubmit={handleMemberLookup as SubmitEventHandler<HTMLFormElement>}>
        <FormColumn>
          <Field label="会員 ID" name="memberId" onChange={setMemberId} required value={memberId} />
          <Button type="submit">会員の問い合わせを表示</Button>
        </FormColumn>
      </form>
      <form onSubmit={handleInquiryLookup as SubmitEventHandler<HTMLFormElement>}>
        <FormColumn>
          <Field label="問い合わせ ID" name="lookupId" onChange={setLookupId} value={lookupId} />
          <Button type="submit">問い合わせを表示</Button>
        </FormColumn>
      </form>
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
      {memberInquiries !== undefined && (
        <section aria-label="会員の問い合わせ一覧">
          <Heading as="h2" size="section">
            会員の問い合わせ
          </Heading>
          {memberInquiries.length === 0 ? (
            <StatusMessage variant={STATUS_VARIANT.pending}>問い合わせはありません。</StatusMessage>
          ) : (
            <ul className="flex flex-col gap-2">
              {memberInquiries.map((inquiry) => (
                <li key={inquiry.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-border px-3 py-2 text-left"
                    onClick={() => {
                      void loadInquiry(inquiry.id)
                        .then(setSelected)
                        .catch((failure: unknown) => {
                          setError(
                            failure instanceof Error
                              ? failure.message
                              : "問い合わせを読めませんでした。",
                          );
                        });
                    }}
                  >
                    <p className="font-medium">{inquiry.subject}</p>
                    <p className="text-sm text-muted-foreground">会員 ID: {inquiry.memberId}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {selected !== undefined && (
        <section aria-label="問い合わせの詳細">
          <Heading as="h2" size="section">
            {selected.subject}
          </Heading>
          <p className="text-sm text-muted-foreground">会員 ID: {selected.memberId}</p>
          <ul className="flex flex-col gap-3">
            {selected.messages.map((message) => (
              <li key={message.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">
                  {message.authorKind === ROLE.administrator ? "運営" : "会員"}
                </p>
                <p className="whitespace-pre-wrap">{message.body}</p>
                <p className="text-xs text-muted-foreground">
                  {createdAtLabel.format(message.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

export { InquiriesPage };
