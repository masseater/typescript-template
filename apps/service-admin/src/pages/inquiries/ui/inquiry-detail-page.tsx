import { ROLE } from "@repo/config";
import {
  Heading,
  NavigationLink,
  STATUS_VARIANT,
  StatusMessage,
  TextLink,
  resultError,
} from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { useInquiryList } from "#pages/inquiries/model/inquiry-list.ts";
import { useInquiryThread } from "#pages/inquiries/model/inquiry-thread.ts";
import { inquiryStatusLabel, isInquiryClosed } from "#pages/inquiries/model/status-label.ts";
import { InquiryMemberSummary } from "./inquiry-member-summary.tsx";
import { InquiryReplyForm } from "./inquiry-reply-form.tsx";

import type { ReactElement } from "react";

const createdAtLabel = new Intl.DateTimeFormat("ja", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function InquiryDetailPage({ inquiryId }: Readonly<{ inquiryId: string }>): ReactElement {
  const listing = useInquiryList();
  const { reload, thread } = useInquiryThread(inquiryId);
  const error = resultError(thread) ?? resultError(listing);

  if (error !== undefined) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>
        <TextLink to="/inquiries">一覧へ</TextLink>
      </main>
    );
  }

  if (!AsyncResult.isSuccess(thread) || !AsyncResult.isSuccess(listing)) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      </main>
    );
  }

  const inquiry = thread.value;
  const inquiries = listing.value;
  const closed = isInquiryClosed(inquiry.status);

  return (
    <main className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[14rem_minmax(0,1fr)_14rem]">
      <section
        aria-label="問い合わせ一覧"
        className="flex flex-col gap-2 overflow-y-auto border-r border-border pr-4"
      >
        <Heading as="h2" size="section">
          一覧
        </Heading>
        <ul className="flex flex-col gap-1">
          {inquiries.map((item) => (
            <li key={item.id}>
              <NavigationLink
                to="/inquiries/$id"
                params={{ id: item.id }}
                variant="item"
                activeOptions={{ exact: true, includeSearch: false }}
              >
                <span className="block truncate text-sm">{item.subject}</span>
              </NavigationLink>
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="やり取り" className="flex min-w-0 flex-col gap-4 overflow-y-auto">
        <TextLink to="/inquiries">一覧へ</TextLink>
        <Heading as="h1" size="page">
          {inquiry.subject}
        </Heading>
        <p className="text-sm leading-normal text-muted-foreground">
          会員・{inquiryStatusLabel(inquiry.status)}
        </p>
        <ul className="flex flex-col gap-3">
          {inquiry.messages.map((message) => (
            <li
              key={message.id}
              className={`rounded-lg border border-border p-3 ${message.authorKind === ROLE.administrator ? "bg-muted" : ""}`}
            >
              <p className="text-sm leading-normal font-medium">
                {message.authorKind === ROLE.administrator ? "運営" : "会員"}
              </p>
              <p className="text-base leading-normal whitespace-pre-wrap">{message.body}</p>
              <p className="text-xs leading-normal text-muted-foreground">
                {createdAtLabel.format(message.createdAt)}
              </p>
            </li>
          ))}
        </ul>
        {!closed && <InquiryReplyForm inquiryId={inquiryId} onChanged={reload} />}
      </section>
      <InquiryMemberSummary memberId={inquiry.memberId} />
    </main>
  );
}

export { InquiryDetailPage };
