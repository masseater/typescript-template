import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import {
  InquiryCreate,
  InquiryList,
  InquiryReply,
  InquiryThread,
} from "#shared/contracts/index.ts";

function loadInquiries(): Promise<typeof InquiryList.Type> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.support.get().then((response) => apiData(InquiryList, response)),
  );
}

function loadInquiry(id: string): Promise<typeof InquiryThread.Type> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.support.detail.get({ query: { id } }).then((response) => apiData(InquiryThread, response)),
  );
}

function createInquiry(values: typeof InquiryCreate.Type): Promise<typeof InquiryThread.Type> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.support.post(values).then((response) => apiData(InquiryThread, response)),
  );
}

function replyToInquiry(values: typeof InquiryReply.Type): Promise<typeof InquiryThread.Type> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.support.reply.post(values).then((response) => apiData(InquiryThread, response)),
  );
}

export { createInquiry, loadInquiry, loadInquiries, replyToInquiry };
