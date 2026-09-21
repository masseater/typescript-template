import { assert, it } from "@effect/vitest";
import { inquiryStaff, type ReadOnlyInquiryStaff } from "@repo/db/inquiry-staff";

it("keeps staff inquiry access read-only outside the admin app", () => {
  const staff: ReadOnlyInquiryStaff = inquiryStaff;
  assert.isFunction(staff.getInquiry);
  assert.isFunction(staff.inquiryCounts);
  assert.isFunction(staff.listMemberInquiries);
  assert.notProperty(staff, "replyAsAdmin");
  assert.notProperty(staff, "closeInquiry");
});
