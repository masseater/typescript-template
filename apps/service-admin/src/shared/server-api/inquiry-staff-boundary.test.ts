import { describe, it } from "@effect/vitest";
import { inquiryStaff, type ReadOnlyInquiryStaff } from "@repo/db/inquiry-staff";
import { expect } from "vite-plus/test";

describe("the staff surface", () => {
  it("keeps staff inquiry access read-only outside the admin app", () => {
    const staff: ReadOnlyInquiryStaff = inquiryStaff;
    expect(staff).toStrictEqual({
      getInquiry: expect.any(Function),
      inquiryCounts: expect.any(Function),
      listMemberInquiries: expect.any(Function),
    });
  });
});
