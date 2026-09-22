import { useAtomValue } from "@effect/atom-react";
import { requestAtom, type RequestResult } from "@repo/ui";

import { loadInquiries } from "#pages/support/api/support.ts";

import type { InquirySummary } from "./inquiry.ts";

const inquiryListAtom = requestAtom((): Promise<readonly InquirySummary[]> =>
  loadInquiries().then((list) => list.inquiries),
);

function useInquiryList(): RequestResult<readonly InquirySummary[]> {
  return useAtomValue(inquiryListAtom);
}

export { useInquiryList };
