import { ROLE } from "@repo/config";
import { Button, Field, FormColumn, Heading, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { useInquiryLookup } from "#pages/inquiries/model/inquiry-lookup.ts";
import { OpsPage } from "#widgets/ops-page/index.ts";
import { InquiryCounts } from "./inquiry-counts.tsx";

import type { ReactElement } from "react";

const createdAtLabel = new Intl.DateTimeFormat("ja", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function InquiriesPage(): ReactElement {
  const lookup = useInquiryLookup();
  const { counts, error, memberInquiries, selected } = lookup;

  return (
    <OpsPage title="問い合わせ">
      <p className="text-base leading-normal text-muted-foreground">
        読むだけの画面です。返信は管理者アプリで行います。
      </p>
      {counts === undefined && error === undefined && (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      )}
      {counts !== undefined && <InquiryCounts counts={counts} />}
      <form onSubmit={lookup.handleMemberLookup}>
        <FormColumn>
          <Field
            label="会員 ID"
            name="memberId"
            onValueChange={lookup.handleMemberIdChange}
            required
            value={lookup.memberId}
          />
          <Button type="submit">会員の問い合わせを表示</Button>
        </FormColumn>
      </form>
      <form onSubmit={lookup.handleInquiryLookup}>
        <FormColumn>
          <Field
            label="問い合わせ ID"
            name="lookupId"
            onValueChange={lookup.handleLookupIdChange}
            value={lookup.lookupId}
          />
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
            <StatusMessage variant={STATUS_VARIANT.empty}>問い合わせはありません。</StatusMessage>
          ) : (
            <ul className="flex flex-col gap-2">
              {memberInquiries.map((inquiry) => (
                <li key={inquiry.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-border px-3 py-2 text-left"
                    onClick={() => {
                      lookup.showInquiry(inquiry.id);
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
    </OpsPage>
  );
}

export { InquiriesPage };
