import { assert, it } from "@effect/vitest";
import { inquiryStaff, type ReadOnlyInquiryStaff } from "@repo/db/inquiry-staff";
import { httpStatus } from "@repo/observability";
import { recordingSink } from "@repo/observability/testing";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { fixtureOrigin } from "@repo/runtime/testing";
import { Effect } from "effect";

import { inquiryApi } from "./inquiry-api.ts";
import { reporting, runtime } from "./runtime.ts";

function dashboardApp() {
  const api = apiRoutes(runtime, reporting);
  return createApi(apiRoot).use(inquiryApi(api));
}

async function postInquiry(path: string): Promise<number> {
  const app = dashboardApp();
  const response = await app.fetch(
    new Request(`${fixtureOrigin}${apiRoot}${path}`, {
      body: "{}",
      headers: { "content-type": "application/json", origin: fixtureOrigin },
      method: "POST",
    }),
  );
  return response.status;
}

it.effect("rejects write requests on inquiry routes", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* Effect.promise(async () => postInquiry("/inquiries/counts")),
      httpStatus.notFound,
    );
    assert.strictEqual(
      yield* Effect.promise(async () => postInquiry("/inquiries/member")),
      httpStatus.notFound,
    );
    assert.strictEqual(
      yield* Effect.promise(async () => postInquiry("/inquiries/detail")),
      httpStatus.notFound,
    );
  }),
);

it("exposes only read-only inquiry staff operations", () => {
  const staff: ReadOnlyInquiryStaff = inquiryStaff;
  assert.isFunction(staff.getInquiry);
  assert.isFunction(staff.inquiryCounts);
  assert.isFunction(staff.listMemberInquiries);
  assert.notProperty(staff, "replyAsAdmin");
  assert.notProperty(staff, "createMemberInquiry");
});
