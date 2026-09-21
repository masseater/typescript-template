import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { requestAtom, type RequestResult } from "@repo/ui";
import { Atom } from "effect/unstable/reactivity";

import { loadInquiry } from "#pages/support/api/support.ts";

import type { InquiryDetail } from "./inquiry.ts";

const inquiryThreadAtom = Atom.family((inquiryId: string) =>
  requestAtom(async () => loadInquiry(inquiryId)),
);

function useInquiryThread(
  inquiryId: string,
): Readonly<{ reload: () => void; thread: RequestResult<InquiryDetail> }> {
  const atom = inquiryThreadAtom(inquiryId);
  return { reload: useAtomRefresh(atom), thread: useAtomValue(atom) };
}

export { useInquiryThread };
