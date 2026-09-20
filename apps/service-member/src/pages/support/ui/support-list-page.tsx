import {
  Button,
  Field,
  FormColumn,
  Heading,
  NavigationLink,
  Page,
  STATUS_VARIANT,
  StatusMessage,
  TextLink,
  useAction,
} from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { createInquiry, loadInquiries } from "#pages/support/api/support.ts";
import { maximumBodyLength, maximumSubjectLength } from "#shared/contracts/index.ts";

import type { InquirySummary } from "#pages/support/model/inquiry.ts";
import type { ReactElement, SubmitEventHandler } from "react";

const updatedAtLabel = new Intl.DateTimeFormat("ja", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function SupportListPage(): ReactElement {
  const [inquiries, setInquiries] = useState<readonly InquirySummary[] | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const action = useAction();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void loadInquiries()
      .then((list) => {
        if (active) {
          setInquiries(list.inquiries);
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
  }, []);

  function handleCreate(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      const created = await createInquiry({ body, subject });
      void navigate({ params: { id: created.id }, to: "/support/$id" });
    });
  }

  if (creating) {
    return (
      <Page title="お問い合わせ">
        <form onSubmit={handleCreate as SubmitEventHandler<HTMLFormElement>}>
          <FormColumn>
            <Field
              label="件名"
              maxLength={maximumSubjectLength}
              name="subject"
              onChange={setSubject}
              required
              value={subject}
            />
            <Field
              label="内容"
              maxLength={maximumBodyLength}
              multiline
              name="body"
              onChange={setBody}
              required
              value={body}
            />
            <div className="flex gap-2">
              <Button disabled={action.blocked} pending={action.pending} type="submit">
                送信
              </Button>
              <Button
                disabled={action.pending}
                onClick={() => {
                  setCreating(false);
                }}
                type="button"
                variant="outline"
              >
                戻る
              </Button>
            </div>
            {action.error !== undefined && (
              <p className="text-sm text-destructive">{action.error}</p>
            )}
          </FormColumn>
        </form>
      </Page>
    );
  }

  return (
    <Page title="お問い合わせ">
      <Button
        aria-label="新しい問い合わせ"
        onClick={() => {
          setCreating(true);
        }}
        type="button"
      >
        新しい問い合わせ
      </Button>
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
      {inquiries === undefined && error === undefined && (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      )}
      {inquiries !== undefined && inquiries.length === 0 && (
        <StatusMessage variant={STATUS_VARIANT.pending}>まだ問い合わせはありません。</StatusMessage>
      )}
      {inquiries !== undefined && inquiries.length > 0 && (
        <ul className="flex flex-col gap-2">
          {inquiries.map((inquiry) => (
            <li key={inquiry.id}>
              <NavigationLink to="/support/$id" params={{ id: inquiry.id }} variant="item">
                <Heading as="h2" size="block">
                  {inquiry.subject}
                </Heading>
                <p className="text-sm leading-normal text-muted-foreground">
                  {inquiry.statusLabel}・{updatedAtLabel.format(inquiry.updatedAt)}
                </p>
              </NavigationLink>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

export { SupportListPage };
