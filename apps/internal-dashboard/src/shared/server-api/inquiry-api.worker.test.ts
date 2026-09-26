import { assert, describe, it } from "@effect/vitest";
import { httpStatus } from "@repo/config";
import { inquiryStaff, type ReadOnlyInquiryStaff } from "@repo/db/inquiry-staff";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { fixtureOrigin } from "@repo/runtime/testing";
import { Effect } from "effect";
import { expect } from "vite-plus/test";

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

describe("the staff surface", () => {
  it("exposes only read-only inquiry staff operations", () => {
    const staff: ReadOnlyInquiryStaff = inquiryStaff;
    expect(staff).toStrictEqual({
      getInquiry: expect.any(Function),
      inquiryCounts: expect.any(Function),
      listMemberInquiries: expect.any(Function),
    });
  });
});
