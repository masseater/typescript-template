import { apiData } from "@repo/runtime/client";
import { queryOptions } from "@tanstack/react-query";

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

const inquiryCountsOptions = queryOptions({
  queryFn: loadInquiryCounts,
  queryKey: ["staff-inquiries", "counts"],
  retry: false,
});

function memberInquiriesOptions(memberId: string) {
  return queryOptions({
    queryFn: () => loadMemberInquiries(memberId),
    queryKey: ["staff-inquiries", "member", memberId] as const,
    retry: false,
  });
}

function inquiryOptions(inquiryId: string) {
  return queryOptions({
    queryFn: () => loadInquiry(inquiryId),
    queryKey: ["staff-inquiries", "detail", inquiryId] as const,
    retry: false,
  });
}

export { inquiryCountsOptions, inquiryOptions, memberInquiriesOptions };
