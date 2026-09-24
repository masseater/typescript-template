import { httpStatus } from "@repo/config";
import { inquiryStaff } from "@repo/db/inquiry-staff";
import { unavailable } from "@repo/runtime/account";
import { createApi, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  InquiryQuery,
  MemberQuery,
  StaffInquiryCounts,
  StaffInquiryList,
  StaffInquiryThread,
} from "#shared/contracts/index.ts";

import type { WikiServices } from "#shared/wiki/index.ts";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = {
  ...unavailable,
  InquiryNotFound: { message: "問い合わせが見つかりません。", status: httpStatus.notFound },
};

function inquiryApi(api: ApiRoutes<WikiServices>) {
  return createApi("")
    .get(
      "/inquiries/counts",
      api.route(StaffInquiryCounts, () => inquiryStaff.inquiryCounts(), failures),
    )
    .get(
      "/inquiries/member",
      api.route(
        StaffInquiryList,
        (request) =>
          Effect.gen(function* handle() {
            const { id } = yield* readSearchParams(MemberQuery, request);
            const inquiries = yield* inquiryStaff.listMemberInquiries(id);
            return { inquiries };
          }),
        failures,
      ),
    )
    .get(
      "/inquiries/detail",
      api.route(
        StaffInquiryThread,
        (request) =>
          Effect.gen(function* handle() {
            const { id } = yield* readSearchParams(InquiryQuery, request);
            return yield* inquiryStaff.getInquiry(id);
          }),
        failures,
      ),
    );
}

export { inquiryApi };
