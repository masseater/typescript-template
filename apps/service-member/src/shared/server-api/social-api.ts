import { verifySession } from "@repo/auth";
import { unavailable } from "@repo/runtime/account";
import { createApi, readJsonBody } from "@repo/runtime/http";
import { Effect } from "effect";

import { HomeFeed, OnboardingAdvance, OnboardingView } from "#shared/contracts/index.ts";
import { advanceOnboarding, homeFeed, stepOf } from "./member-social.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = { ...unavailable };

function socialApi(api: ApiRoutes<AppServices>) {
  return createApi("")
    .get(
      "/onboarding",
      api.route(OnboardingView)(
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return { step: yield* stepOf(user.id) };
          }),
        failures,
      ),
    )
    .post(
      "/onboarding",
      api.route(OnboardingView)(
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { step } = yield* readJsonBody(OnboardingAdvance, request);
            yield* advanceOnboarding(user.id, step);
            return { step };
          }),
        failures,
      ),
    )
    .get(
      "/home/feed",
      api.route(HomeFeed)(
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return { items: yield* homeFeed(user.id) };
          }),
        failures,
      ),
    );
}

export { socialApi };
