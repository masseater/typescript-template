import { verifySession } from "@repo/auth";
import { sessionFailures } from "@repo/runtime/account";
import { createApi } from "@repo/runtime/http";
import { Effect } from "effect";

import { HomeFeed, OnboardingAdvance, OnboardingView } from "#shared/contracts/index.ts";
import { advanceOnboarding, homeFeed, stepOf } from "./member-social.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

function socialApi(api: ApiRoutes<AppServices>) {
  return createApi("")
    .get(
      "/onboarding",
      ...api.route(
        { response: OnboardingView },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return { step: yield* stepOf(user.id) };
          }),
        sessionFailures,
      ),
    )
    .post(
      "/onboarding",
      ...api.route(
        { body: OnboardingAdvance, response: OnboardingView },
        (request, { step }) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            yield* advanceOnboarding(user.id, step);
            return { step };
          }),
        sessionFailures,
      ),
    )
    .get(
      "/home/feed",
      ...api.route(
        { response: HomeFeed },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return { items: yield* homeFeed(user.id) };
          }),
        sessionFailures,
      ),
    );
}

export { socialApi };
