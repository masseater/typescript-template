import { ROLE } from "@repo/config";
import {
  Button,
  Field,
  FormColumn,
  Heading,
  NavigationLink,
  STATUS_VARIANT,
  StatusMessage,
  TextLink,
  useAction,
} from "@repo/ui";
import { useEffect, useState } from "react";

import {
  closeInquiry,
  loadInquiries,
  loadInquiry,
  loadMemberSummary,
  replyToInquiry,
} from "#pages/inquiries/api/inquiries.ts";
import { inquiryStatusLabel, isInquiryClosed } from "#pages/inquiries/model/status-label.ts";
import { maximumBodyLength } from "#shared/contracts/index.ts";

import type {
  AdminInquiryDetail,
  AdminInquirySummary,
  InquiryMemberSummary,
} from "#pages/inquiries/model/inquiry.ts";
import type { ReactElement, SubmitEventHandler } from "react";

const createdAtLabel = new Intl.DateTimeFormat("ja", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function InquiryDetailPage({ inquiryId }: Readonly<{ inquiryId: string }>): ReactElement {
  const [inquiries, setInquiries] = useState<readonly AdminInquirySummary[] | undefined>();
  const [inquiry, setInquiry] = useState<AdminInquiryDetail | undefined>();
  const [member, setMember] = useState<InquiryMemberSummary | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [body, setBody] = useState("");
  const action = useAction();

  useEffect(() => {
    let active = true;
    void Promise.all([loadInquiries({ limit: 50, offset: 0 }), loadInquiry(inquiryId)])
      .then(async ([list, thread]) => {
        if (!active) {
          return;
        }
        setInquiries(list.inquiries);
        setInquiry(thread);
        const summary = await loadMemberSummary(thread.memberId);
        if (active) {
          setMember(summary);
        }
      })
      .catch((failure: unknown) => {
        if (active) {
          setError(failure instanceof Error ? failure.message : "問い合わせを読めませんでした。");
        }
      });
    return () => {
      active = false;
    };
  }, [inquiryId]);

  function handleReply(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      const updated = await replyToInquiry({ body, id: inquiryId });
      setInquiry(updated);
      setBody("");
    });
  }

  function handleClose(): void {
    action.run(async () => {
      const updated = await closeInquiry(inquiryId);
      setInquiry(updated);
    });
  }

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
        {!closed && (
          <form onSubmit={handleReply as SubmitEventHandler<HTMLFormElement>}>
            <FormColumn>
              <Field
                label="返信"
                maxLength={maximumBodyLength}
                multiline
                name="body"
                onChange={setBody}
                required
                value={body}
              />
              <div className="flex gap-2">
                <Button disabled={action.blocked} pending={action.pending} type="submit">
                  返信する
                </Button>
                <Button
                  disabled={action.pending}
                  onClick={handleClose}
                  type="button"
                  variant="outline"
                >
                  完了にする
                </Button>
              </div>
              {action.error !== undefined && (
                <p className="text-sm text-destructive">{action.error}</p>
              )}
            </FormColumn>
          </form>
        )}
      </section>
      <aside aria-label="利用者の要約" className="flex flex-col gap-2 border-l border-border pl-4">
        <Heading as="h2" size="section">
          利用者
        </Heading>
        {member === undefined ? (
          <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
        ) : (
          <>
            <p className="text-base leading-normal font-medium">{member.name}</p>
            <p className="text-sm leading-normal text-muted-foreground">{member.email}</p>
            <TextLink to="/members/$id" params={{ id: member.id }}>
              利用者の詳細
            </TextLink>
          </>
        )}
      </aside>
    </main>
  );
}

export { InquiryDetailPage };
