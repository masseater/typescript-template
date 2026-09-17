import { verifySession } from "@template/auth";
import { UserNotFound, getProfile, updateProfile } from "@template/db";
import type { AppServices } from "@template/runtime";
import { accountApi, unavailable } from "@template/runtime/account";
import { ProfileUpdate, ProfileView } from "@template/runtime/contracts";
import { apiBridge, compileApi, createApi, readJsonBody } from "@template/runtime/http";
import { Effect } from "effect";

const bridge = apiBridge<AppServices>();
const failures = {
  ...unavailable,
  UserNotFound: { status: 404, message: "対象が見つかりません。" },
};

const api = createApi()
  .use(accountApi(bridge))
  .get(
    "/api/profile",
    bridge.route(
      ProfileView,
      (request) =>
        Effect.gen(function* () {
          const { user } = yield* verifySession(request.headers);
          const profile = yield* getProfile(user.id);
          if (profile === null) return yield* new UserNotFound();
          return profile;
        }),
      failures,
    ),
  )
  .patch(
    "/api/profile",
    bridge.route(
      ProfileView,
      (request) =>
        Effect.gen(function* () {
          const { user } = yield* verifySession(request.headers);
          const values = yield* readJsonBody(ProfileUpdate, request);
          return yield* updateProfile(user.id, values);
        }),
      failures,
    ),
  );

export const userApi = compileApi(api);
export const dispatchUserApi = bridge.dispatch;
