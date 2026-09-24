import { Button, Page, localState, resultError } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { AsyncResult } from "effect/unstable/reactivity";

import { useInquiryList } from "#pages/support/model/inquiry-list.ts";
import { InquiryListing } from "./inquiry-listing.tsx";
import { NewInquiryForm } from "./new-inquiry-form.tsx";

import type { ReactElement } from "react";

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
      <InquiryListing error={error} inquiries={inquiries} />
    </Page>
  );
}

export { SupportListPage };
