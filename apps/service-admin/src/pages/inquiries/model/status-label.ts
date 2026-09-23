import { INQUIRY_STATUS, inquiryStatusLabels, type InquiryStatus } from "@repo/config";

function inquiryStatusLabel(status: InquiryStatus): string {
  return inquiryStatusLabels[status];
}

function isInquiryClosed(status: InquiryStatus): boolean {
  return status === INQUIRY_STATUS.closed;
}

export { INQUIRY_STATUS, inquiryStatusLabel, isInquiryClosed };
export type { InquiryStatus };
