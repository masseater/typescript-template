import { Heading, Page, STATUS_VARIANT, StatusMessage, TextLink, resultError } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { useInquiryThread } from "#pages/support/model/inquiry-thread.ts";
import { InquiryReplyForm } from "./inquiry-reply-form.tsx";

import type { ReactElement } from "react";

const createdAtLabel = new Intl.DateTimeFormat("ja", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function SupportDetailPage({ inquiryId }: Readonly<{ inquiryId: string }>): ReactElement {
  const { reload, thread } = useInquiryThread(inquiryId);
  const error = resultError(thread);

  if (error !== undefined) {
    return (
      <Page title="お問い合わせ">
        <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>
        <TextLink to="/support">一覧へ</TextLink>
      </Page>
    );
  }

  if (!AsyncResult.isSuccess(thread)) {
    return (
      <Page title="お問い合わせ">
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      </Page>
    );
  }

  const inquiry = thread.value;

  return (
    <Page title="お問い合わせ">
      <TextLink to="/support">一覧へ</TextLink>
      <Heading as="h2" size="section">
        {inquiry.subject}
      </Heading>
      <p className="text-sm leading-normal text-muted-foreground">{inquiry.statusLabel}</p>
      <ul className="flex flex-col gap-3">
        {inquiry.messages.map((message) => (
          <li
            key={message.id}
            className={`rounded-lg border border-border p-3 ${message.fromOperator ? "bg-muted" : ""}`}
          >
            <p className="text-sm leading-normal font-medium">
              {message.fromOperator ? "運営" : "自分"}
            </p>
            <p className="text-base leading-normal whitespace-pre-wrap">{message.body}</p>
            <p className="text-xs leading-normal text-muted-foreground">
              {createdAtLabel.format(message.createdAt)}
            </p>
          </li>
        ))}
      </ul>
      {!inquiry.closed && <InquiryReplyForm inquiryId={inquiryId} onReplied={reload} />}
    </Page>
  );
}

export { SupportDetailPage };
