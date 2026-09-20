import {
  Button,
  Field,
  FormColumn,
  Heading,
  Page,
  STATUS_VARIANT,
  StatusMessage,
  TextLink,
  useAction,
} from "@repo/ui";
import { useEffect, useState } from "react";

import { loadInquiry, replyToInquiry } from "#pages/support/api/support.ts";
import { maximumBodyLength } from "#shared/contracts/index.ts";

import type { InquiryDetail } from "#pages/support/model/inquiry.ts";
import type { ReactElement, SubmitEventHandler } from "react";

const createdAtLabel = new Intl.DateTimeFormat("ja", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function SupportDetailPage({ inquiryId }: Readonly<{ inquiryId: string }>): ReactElement {
  const [inquiry, setInquiry] = useState<InquiryDetail | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [body, setBody] = useState("");
  const action = useAction();

  useEffect(() => {
    let active = true;
    void loadInquiry(inquiryId)
      .then((thread) => {
        if (active) {
          setInquiry(thread);
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

  if (error !== undefined) {
    return (
      <Page title="お問い合わせ">
        <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>
        <TextLink to="/support">一覧へ</TextLink>
      </Page>
    );
  }

  if (inquiry === undefined) {
    return (
      <Page title="お問い合わせ">
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      </Page>
    );
  }

  const closed = inquiry.closed;

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
      {!closed && (
        <form onSubmit={handleReply as SubmitEventHandler<HTMLFormElement>}>
          <FormColumn>
            <Field
              label="追加の内容"
              maxLength={maximumBodyLength}
              multiline
              name="body"
              onChange={setBody}
              required
              value={body}
            />
            <Button disabled={action.blocked} pending={action.pending} type="submit">
              送る
            </Button>
            {action.error !== undefined && (
              <p className="text-sm text-destructive">{action.error}</p>
            )}
          </FormColumn>
        </form>
      )}
    </Page>
  );
}

export { SupportDetailPage };
