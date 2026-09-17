import { MemberQuery, MemberView, ProfileUpdate, ProfileView } from "@template/runtime/contracts";
import { UserNotFound, getMember, getProfile, updateProfile } from "@template/db";
import { accountApi, unavailable } from "@template/runtime/account";
import {
  apiBridge,
  compileApi,
  createApi,
  readJsonBody,
  readSearchParams,
} from "@template/runtime/http";
import type { AppServices } from "@template/runtime";
import { Effect } from "effect";
import type { Interviewer } from "@template/interview";
import { interviewApi } from "./interview-api.ts";
import { verifySession } from "@template/auth";

const bridge = apiBridge<AppServices | Interviewer>();
const failures = {
  ...unavailable,
  UserNotFound: { message: "対象が見つかりません。", status: 404 },
};

const api = createApi()
  .use(accountApi(bridge))
  .use(interviewApi(bridge))
  .get(
    "/api/profile",
    bridge.route(
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
  .get(
    "/api/member",
    bridge.route(
      MemberView,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (request) =>
        Effect.gen(function* handleRequest() {
          const { user } = yield* verifySession(request.headers);
          const { id } = yield* readSearchParams(MemberQuery, request);
          return yield* getMember(user.id, id);
        }),
      failures,
    ),
  )
  .patch(
    "/api/profile",
    bridge.route(
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

const userApi = compileApi(api);
const dispatchUserApi = bridge.dispatch;

export { dispatchUserApi, userApi };
