import { useAtom, useAtomValue } from "@effect/atom-react";
import { request, requestAtom, resultError, useTextInput } from "@repo/ui";
import { Atom, AsyncResult } from "effect/unstable/reactivity";

import {
  loadInquiry,
  loadInquiryCounts,
  loadMemberInquiries,
} from "#pages/inquiries/api/inquiries.ts";

import type {
  StaffInquiryCountsView,
  StaffInquiryList,
  StaffInquiryThreadView,
} from "#shared/contracts/index.ts";
import type { SubmitEventHandler } from "react";

type StaffInquirySummary = (typeof StaffInquiryList.Type)["inquiries"][number];

interface InquiryLookup {
  readonly counts: StaffInquiryCountsView | undefined;
  readonly error: string | undefined;
  readonly handleInquiryLookup: SubmitEventHandler<HTMLFormElement>;
  readonly handleLookupIdChange: (value: string) => void;
  readonly handleMemberIdChange: (value: string) => void;
  readonly handleMemberLookup: SubmitEventHandler<HTMLFormElement>;
  readonly lookupId: string;
  readonly memberId: string;
  readonly memberInquiries: readonly StaffInquirySummary[] | undefined;
  readonly selected: StaffInquiryThreadView | undefined;
  readonly showInquiry: (inquiryId: string) => void;
}

const countsAtom = requestAtom(loadInquiryCounts);

const memberInquiriesAtom = Atom.fn((memberId: string) =>
  request(async (): Promise<readonly StaffInquirySummary[]> => {
    return (await loadMemberInquiries(memberId)).inquiries;
  }),
);

const selectedInquiryAtom = Atom.fn((inquiryId: string) =>
  request(async () => loadInquiry(inquiryId)),
);

function useInquiryLookup(): InquiryLookup {
  const counts = useAtomValue(countsAtom);
  const memberId = useTextInput();
  const lookupId = useTextInput();
  const [memberListing, lookupMember] = useAtom(memberInquiriesAtom);
  const [selection, select] = useAtom(selectedInquiryAtom);

  function handleMemberLookup(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    select(Atom.Reset);
    lookupMember(memberId.value);
  }
  function handleInquiryLookup(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    select(lookupId.value);
  }
  function showInquiry(inquiryId: string): void {
    select(inquiryId);
  }

  return {
    counts: AsyncResult.isSuccess(counts) ? counts.value : undefined,
    error: resultError(counts) ?? resultError(memberListing) ?? resultError(selection),
    handleInquiryLookup,
    handleLookupIdChange: lookupId.handleChange,
    handleMemberIdChange: memberId.handleChange,
    handleMemberLookup,
    lookupId: lookupId.value,
    memberId: memberId.value,
    memberInquiries: AsyncResult.isSuccess(memberListing) ? memberListing.value : undefined,
    selected: AsyncResult.isSuccess(selection) ? selection.value : undefined,
    showInquiry,
  };
}

export { useInquiryLookup };
