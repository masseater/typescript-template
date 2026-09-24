import { INQUIRY_STATUS, type InquiryStatus } from "@repo/config";

function isInquiryClosed(status: InquiryStatus): boolean {
  return status === INQUIRY_STATUS.closed;
}

export { isInquiryClosed };
