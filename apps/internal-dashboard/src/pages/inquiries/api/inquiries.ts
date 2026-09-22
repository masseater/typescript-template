import { apiData } from "@repo/runtime/client";

import { wikiClient } from "#shared/api/index.ts";
import {
  StaffInquiryCounts,
  StaffInquiryList,
  StaffInquiryThread,
} from "#shared/contracts/index.ts";

function loadInquiryCounts(): Promise<typeof StaffInquiryCounts.Type> {
  return Promise.resolve(wikiClient()).then(({ api }) =>
    api.inquiries.counts.get().then((response) => apiData(StaffInquiryCounts, response)),
  );
}

function loadMemberInquiries(memberId: string): Promise<typeof StaffInquiryList.Type> {
  return Promise.resolve(wikiClient()).then(({ api }) =>
    api.inquiries.member
      .get({ query: { id: memberId } })
      .then((response) => apiData(StaffInquiryList, response)),
  );
}

function loadInquiry(id: string): Promise<typeof StaffInquiryThread.Type> {
  return Promise.resolve(wikiClient()).then(({ api }) =>
    api.inquiries.detail
      .get({ query: { id } })
      .then((response) => apiData(StaffInquiryThread, response)),
  );
}

export { loadInquiry, loadInquiryCounts, loadMemberInquiries };
