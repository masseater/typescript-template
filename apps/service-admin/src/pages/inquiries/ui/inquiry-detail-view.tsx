import { ROLE, inquiryStatusLabels } from "@repo/config";
import {
  Heading,
  NavigationLink,
  STATUS_VARIANT,
  StatusMessage,
  TextLink,
  formatWarekiDateTime,
  type UiNode,
} from "@repo/ui";

import type {
  AdminInquiryDetail,
  AdminInquirySummary,
  InquiryMemberSummary,
} from "#pages/inquiries/model/inquiry.ts";
import type { ReactElement } from "react";

function InquiryList({
  inquiries,
}: Readonly<{ inquiries: readonly AdminInquirySummary[] }>): ReactElement {
  return (
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
  );
}

function InquiryConversation({
  inquiry,
  replyForm,
}: Readonly<{ inquiry: AdminInquiryDetail; replyForm: UiNode }>): ReactElement {
  return (
    <section aria-label="やり取り" className="flex min-w-0 flex-col gap-4 overflow-y-auto">
      <TextLink to="/inquiries">一覧へ</TextLink>
      <Heading as="h1" size="page">
        {inquiry.subject}
      </Heading>
      <p className="text-sm leading-normal text-muted-foreground">
        会員・{inquiryStatusLabels[inquiry.status]}
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
              {formatWarekiDateTime(message.createdAt.getTime())}
            </p>
          </li>
        ))}
      </ul>
      {inquiry.replyable ? replyForm : null}
    </section>
  );
}

function InquiryDetailView({
  error,
  inquiries,
  inquiry,
  memberSummary,
  replyForm,
}: Readonly<{
  error: string | undefined;
  inquiries: readonly AdminInquirySummary[] | undefined;
  inquiry: AdminInquiryDetail | undefined;
  memberSummary: (memberId: string) => UiNode;
  replyForm: UiNode;
}>): ReactElement {
  if (error !== undefined) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>
        <TextLink to="/inquiries">一覧へ</TextLink>
      </main>
    );
  }
  if (inquiry === undefined || inquiries === undefined) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      </main>
    );
  }
  return (
    <main className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[14rem_minmax(0,1fr)_14rem]">
      <InquiryList inquiries={inquiries} />
      <InquiryConversation inquiry={inquiry} replyForm={replyForm} />
      {memberSummary(inquiry.memberId)}
    </main>
  );
}

function MemberSummaryView({
  failure,
  summary,
}: Readonly<{
  failure: string | undefined;
  summary: typeof InquiryMemberSummary.Type | undefined;
}>): ReactElement {
  return (
    <aside aria-label="利用者の要約" className="flex flex-col gap-2 border-l border-border pl-4">
      <Heading as="h2" size="section">
        利用者
      </Heading>
      {failure !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{failure}</StatusMessage>
      )}
      {failure === undefined && summary === undefined && (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      )}
      {summary !== undefined && (
        <>
          <p className="text-base leading-normal font-medium">{summary.name}</p>
          <p className="text-sm leading-normal text-muted-foreground">{summary.email}</p>
          <TextLink to="/members/$id" params={{ id: summary.id }}>
            利用者の詳細
          </TextLink>
        </>
      )}
    </aside>
  );
}

export { InquiryDetailView, MemberSummaryView };
