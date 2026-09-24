import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { requestAtom, type RequestResult } from "@repo/ui";
import { Atom } from "effect/unstable/reactivity";

import { loadInquiry, loadMemberSummary } from "#pages/inquiries/api/inquiries.ts";

import type { AdminInquiryDetail, InquiryMemberSummary } from "./inquiry.ts";

const inquiryThreadAtom = Atom.family((inquiryId: string) =>
  requestAtom(() => loadInquiry(inquiryId)),
);

const memberSummaryAtom = Atom.family((memberId: string) =>
  requestAtom(() => loadMemberSummary(memberId)),
);

function useInquiryThread(
  inquiryId: string,
): Readonly<{ reload: () => void; thread: RequestResult<AdminInquiryDetail> }> {
  const atom = inquiryThreadAtom(inquiryId);
  return { reload: useAtomRefresh(atom), thread: useAtomValue(atom) };
}

function useMemberSummary(memberId: string): RequestResult<typeof InquiryMemberSummary.Type> {
  return useAtomValue(memberSummaryAtom(memberId));
}

export { useInquiryThread, useMemberSummary };
