import { useAtomValue } from "@effect/atom-react";
import { localState, requestAtom, type RequestResult } from "@repo/ui";
import { Option } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { loadInquiries } from "#pages/inquiries/api/inquiries.ts";

import type { AdminInquirySummary } from "./inquiry.ts";
import type { InquiryStatus } from "./status-label.ts";

const listPageSize = 50;

const inquiryListAtom = Atom.family((status: InquiryStatus | "") =>
  requestAtom((): Promise<readonly AdminInquirySummary[]> => {
    const query = { limit: listPageSize, offset: 0 } as const;
    return loadInquiries(status === "" ? query : { ...query, status }).then(
      (list) => list.inquiries,
    );
  }),
);

const useStatusFilter = localState(Option.none<InquiryStatus>());

function useInquiryList(status?: InquiryStatus): RequestResult<readonly AdminInquirySummary[]> {
  return useAtomValue(inquiryListAtom(status ?? ""));
}

function useInquiryStatusFilter(): Readonly<{
  status: InquiryStatus | undefined;
  toggle: (value: InquiryStatus) => void;
}> {
  const [status, setStatus] = useStatusFilter();
  function toggle(value: InquiryStatus): void {
    setStatus((current) => (Option.contains(current, value) ? Option.none() : Option.some(value)));
  }
  return { status: Option.getOrUndefined(status), toggle };
}

export { useInquiryList, useInquiryStatusFilter };
