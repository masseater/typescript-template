import { localState, useTextInput } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { Option } from "effect";

import {
  inquiryCountsOptions,
  inquiryOptions,
  memberInquiriesOptions,
} from "#pages/inquiries/api/inquiries.ts";

import type { InquiryLookup } from "./inquiry-lookup-state.ts";

const useLookedUpMember = localState(Option.none<string>());
const useSelectedInquiry = localState(Option.none<string>());

function failureOf(query: Readonly<{ error: Error | null }>): string | undefined {
  return query.error?.message;
}

function useInquiryLookup(): InquiryLookup {
  const memberId = useTextInput();
  const lookupId = useTextInput();
  const [lookedUpMember, setLookedUpMember] = useLookedUpMember();
  const [selectedInquiry, setSelectedInquiry] = useSelectedInquiry();
  const counts = useQuery(inquiryCountsOptions);
  const memberListing = useQuery({
    ...memberInquiriesOptions(Option.getOrElse(lookedUpMember, () => "")),
    enabled: Option.isSome(lookedUpMember),
  });
  const selection = useQuery({
    ...inquiryOptions(Option.getOrElse(selectedInquiry, () => "")),
    enabled: Option.isSome(selectedInquiry),
  });

  function handleMemberLookup(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    setSelectedInquiry(Option.none());
    setLookedUpMember(Option.some(memberId.value));
  }
  function handleInquiryLookup(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    setSelectedInquiry(Option.some(lookupId.value));
  }
  function showInquiry(inquiryId: string): void {
    setSelectedInquiry(Option.some(inquiryId));
  }

  return {
    counts: counts.data,
    error: failureOf(counts) ?? failureOf(memberListing) ?? failureOf(selection),
    handleInquiryLookup,
    handleLookupIdChange: lookupId.handleChange,
    handleMemberIdChange: memberId.handleChange,
    handleMemberLookup,
    lookupId: lookupId.value,
    memberId: memberId.value,
    memberInquiries: memberListing.data?.inquiries,
    selected: selection.data,
    showInquiry,
  };
}

export { useInquiryLookup };
