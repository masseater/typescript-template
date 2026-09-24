import { useAtom, useAtomValue } from "@effect/atom-react";
import { firstResultError, request, requestAtom, resultValue, useTextInput } from "@repo/ui";
import { Atom } from "effect/unstable/reactivity";

import {
  loadInquiry,
  loadInquiryCounts,
  loadMemberInquiries,
} from "#pages/inquiries/api/inquiries.ts";

import type { InquiryLookup, StaffInquirySummary } from "./inquiry-lookup-state.ts";

const countsAtom = requestAtom(loadInquiryCounts);

const memberInquiriesAtom = Atom.fn((memberId: string) =>
  request((): Promise<readonly StaffInquirySummary[]> =>
    loadMemberInquiries(memberId).then((result) => result.inquiries),
  ),
);

const selectedInquiryAtom = Atom.fn((inquiryId: string) => request(() => loadInquiry(inquiryId)));

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
    counts: resultValue(counts),
    error: firstResultError(counts, memberListing, selection),
    handleInquiryLookup,
    handleLookupIdChange: lookupId.handleChange,
    handleMemberIdChange: memberId.handleChange,
    handleMemberLookup,
    lookupId: lookupId.value,
    memberId: memberId.value,
    memberInquiries: resultValue(memberListing),
    selected: resultValue(selection),
    showInquiry,
  };
}

export { useInquiryLookup };
