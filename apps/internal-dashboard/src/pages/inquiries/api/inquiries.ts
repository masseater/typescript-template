import { apiData } from "@repo/runtime/client";

import { dashboardClient } from "#shared/api/index.ts";
import {
  InquiryQuery,
  MemberQuery,
  StaffInquiryCounts,
  StaffInquiryList,
  StaffInquiryThread,
} from "#shared/contracts/index.ts";

async function loadInquiryCounts(): Promise<typeof StaffInquiryCounts.Type> {
  const api = await dashboardClient();
  return apiData(StaffInquiryCounts, await api.inquiries.counts.get());
}

async function loadMemberInquiries(memberId: string): Promise<typeof StaffInquiryList.Type> {
  const api = await dashboardClient();
  return apiData(StaffInquiryList, await api.inquiries.member.get({ query: { id: memberId } }));
}

async function loadInquiry(id: string): Promise<typeof StaffInquiryThread.Type> {
  const api = await dashboardClient();
  return apiData(StaffInquiryThread, await api.inquiries.detail.get({ query: { id } }));
}

export { loadInquiry, loadInquiryCounts, loadMemberInquiries };
