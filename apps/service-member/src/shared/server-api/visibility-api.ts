import { verifySession } from "@repo/auth";
import { readVisibility, updateVisibility } from "@repo/db";
import { httpStatus } from "@repo/observability";
import { unavailable } from "@repo/runtime/account";
import { createApi, readJsonBody } from "@repo/runtime/http";
import { Effect } from "effect";

import { VisibilityView } from "#shared/contracts/index.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = {
  ...unavailable,
  UserNotFound: { message: "対象が見つかりません。", status: httpStatus.notFound },
};

function visibilityApi(api: ApiRoutes<AppServices>) {
  return createApi("")
    .get(
      "/profile/visibility",
      api.route(
        VisibilityView,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return yield* readVisibility(user.id);
          }),
        failures,
      ),
    )
    .patch(
      "/profile/visibility",
      api.route(
        VisibilityView,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const values = yield* readJsonBody(VisibilityView, request);
            return yield* updateVisibility(user.id, values);
          }),
        failures,
      ),
    );
}

export { visibilityApi };
