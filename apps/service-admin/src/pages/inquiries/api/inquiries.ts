import { apiData } from "@repo/runtime/client";

import { adminClient } from "#shared/api/index.ts";
import {
  AdminInquiryList,
  AdminInquiryThread,
  InquiryListQuery,
  InquiryMemberSummary,
  InquiryReply,
} from "#shared/contracts/index.ts";

async function loadInquiries(
  query: typeof InquiryListQuery.Type,
): Promise<typeof AdminInquiryList.Type> {
  return apiData(AdminInquiryList, await adminClient().inquiries.get({ query }));
}

async function loadInquiry(id: string): Promise<typeof AdminInquiryThread.Type> {
  return apiData(AdminInquiryThread, await adminClient().inquiries.detail.get({ query: { id } }));
}

async function loadMemberSummary(memberId: string): Promise<typeof InquiryMemberSummary.Type> {
  return apiData(
    InquiryMemberSummary,
    await adminClient().inquiries.member.get({ query: { id: memberId } }),
  );
}

async function replyToInquiry(
  values: typeof InquiryReply.Type,
): Promise<typeof AdminInquiryThread.Type> {
  return apiData(AdminInquiryThread, await adminClient().inquiries.reply.post(values));
}

async function closeInquiry(id: string): Promise<typeof AdminInquiryThread.Type> {
  return apiData(AdminInquiryThread, await adminClient().inquiries.close.post({ id }));
}

export { closeInquiry, loadInquiry, loadInquiries, loadMemberSummary, replyToInquiry };
