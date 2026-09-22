import {
  Button,
  Heading,
  NavigationLink,
  Page,
  STATUS_VARIANT,
  StatusMessage,
  localState,
  resultError,
} from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { AsyncResult } from "effect/unstable/reactivity";

import { useInquiryList } from "#pages/support/model/inquiry-list.ts";
import { NewInquiryForm } from "./new-inquiry-form.tsx";

import type { ReactElement } from "react";

const updatedAtLabel = new Intl.DateTimeFormat("ja", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const useCreating = localState(false);

function SupportListPage(): ReactElement {
  const listing = useInquiryList();
  const [creating, setCreating] = useCreating();
  const navigate = useNavigate();
  const error = resultError(listing);
  const inquiries = AsyncResult.isSuccess(listing) ? listing.value : undefined;

  function openForm(): void {
    setCreating(true);
  }
  function closeForm(): void {
    setCreating(false);
  }
  function showCreated(inquiryId: string): void {
    void navigate({ params: { id: inquiryId }, to: "/support/$id" });
  }

  if (creating) {
    return (
      <Page title="お問い合わせ">
        <NewInquiryForm onCancel={closeForm} onCreated={showCreated} />
      </Page>
    );
  }

  return (
    <Page title="お問い合わせ">
      <Button aria-label="新しい問い合わせ" onClick={openForm} type="button">
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
