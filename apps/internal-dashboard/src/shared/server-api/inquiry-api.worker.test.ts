import { assert, it } from "@effect/vitest";
import { httpStatus } from "@repo/config";
import { inquiryStaff, type ReadOnlyInquiryStaff } from "@repo/db/inquiry-staff";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { fixtureOrigin } from "@repo/runtime/testing";
import { Effect } from "effect";

import { inquiryApi } from "./inquiry-api.ts";
import { reporting, runtime } from "./runtime.ts";

function dashboardApp() {
  const api = apiRoutes(runtime, reporting);
  return createApi(apiRoot).use(inquiryApi(api));
}

function postInquiry(path: string): Promise<number> {
  const app = dashboardApp();
  return Promise.resolve(
    app.fetch(
      new Request(`${fixtureOrigin}${apiRoot}${path}`, {
        body: "{}",
        headers: { "content-type": "application/json", origin: fixtureOrigin },
        method: "POST",
      }),
    ),
  ).then((response) => response.status);
}

it.effect("rejects write requests on inquiry routes", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* Effect.promise(() => postInquiry("/inquiries/counts")),
      httpStatus.notFound,
    );
    assert.strictEqual(
      yield* Effect.promise(() => postInquiry("/inquiries/member")),
      httpStatus.notFound,
    );
    assert.strictEqual(
      yield* Effect.promise(() => postInquiry("/inquiries/detail")),
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
