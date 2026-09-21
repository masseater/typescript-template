import { useAtomValue } from "@effect/atom-react";
import { requestAtom, type RequestResult } from "@repo/ui";

import { loadInquiries } from "#pages/support/api/support.ts";

import type { InquirySummary } from "./inquiry.ts";

const inquiryListAtom = requestAtom(
  async (): Promise<readonly InquirySummary[]> => (await loadInquiries()).inquiries,
);

function useInquiryList(): RequestResult<readonly InquirySummary[]> {
  return useAtomValue(inquiryListAtom);
}

export { useInquiryList };
