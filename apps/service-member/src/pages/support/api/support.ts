import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import {
  InquiryCreate,
  InquiryList,
  InquiryQuery,
  InquiryReply,
  InquiryThread,
} from "#shared/contracts/index.ts";

async function loadInquiries(): Promise<typeof InquiryList.Type> {
  const api = await userClient();
  return apiData(InquiryList, await api.support.get());
}

async function loadInquiry(id: string): Promise<typeof InquiryThread.Type> {
  const api = await userClient();
  return apiData(InquiryThread, await api.support.detail.get({ query: { id } }));
}

async function createInquiry(
  values: typeof InquiryCreate.Type,
): Promise<typeof InquiryThread.Type> {
  const api = await userClient();
  return apiData(InquiryThread, await api.support.post(values));
}

async function replyToInquiry(
  values: typeof InquiryReply.Type,
): Promise<typeof InquiryThread.Type> {
  const api = await userClient();
  return apiData(InquiryThread, await api.support.reply.post(values));
}

export { createInquiry, loadInquiry, loadInquiries, replyToInquiry };
