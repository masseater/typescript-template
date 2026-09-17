import { ProfileUpdate, ProfileView } from "@template/runtime/contracts";
import { UserNotFound, getProfile, updateProfile } from "@template/db";
import { accountApi, unavailable } from "@template/runtime/account";
import { apiRoutes, createApi, readJsonBody } from "@template/runtime/http";
import { Effect } from "effect";
import { interviewApi } from "./interview-api.ts";
import { runtime } from "./runtime.ts";
import { verifySession } from "@template/auth";

const api = apiRoutes(runtime);
const failures = {
  ...unavailable,
  UserNotFound: { message: "対象が見つかりません。", status: 404 },
};

const userApi = createApi()
  .use(accountApi(api))
  .use(interviewApi(api))
  .get(
    "/api/profile",
    api.route(
      ProfileView,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (request) =>
        Effect.gen(function* handleRequest() {
          const { user } = yield* verifySession(request.headers);
          const profile = yield* getProfile(user.id);
          if (profile === null) {
            return yield* new UserNotFound();
          }
          return profile;
        }),
      failures,
    ),
  )
  .patch(
    "/api/profile",
    api.route(
      ProfileView,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (request) =>
        Effect.gen(function* handleRequest() {
          const { user } = yield* verifySession(request.headers);
          const values = yield* readJsonBody(ProfileUpdate, request);
          return yield* updateProfile(user.id, values);
        }),
      failures,
    ),
  );

export { userApi };
