import {
  MemberList,
  MemberListQuery,
  MemberQuery,
  MemberView,
  ProfileUpdate,
  ProfileView,
  memberPageSize,
} from "@template/runtime/contracts";
import { UserNotFound, getMember, getProfile, listMembers, updateProfile } from "@template/db";
import { accountApi, unavailable } from "@template/runtime/account";
import {
  apiRoot,
  apiRoutes,
  compileApi,
  createApi,
  readJsonBody,
  readSearchParams,
} from "@template/runtime/http";
import { Effect } from "effect";
import { httpStatus } from "@template/observability";
import { interviewApi } from "./interview-api.ts";
import { runtime } from "./runtime.ts";
import { verifySession } from "@template/auth";

const api = apiRoutes(runtime, { service: "user" });
const failures = {
  ...unavailable,
  UserNotFound: { message: "対象が見つかりません。", status: httpStatus.notFound },
};

const app = createApi(apiRoot)
  .use(accountApi(api))
  .use(interviewApi(api))
  .get(
    "/profile",
    api.route(
      ProfileView,
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
    "/member",
    api.route(
      MemberView,
      (request) =>
        Effect.gen(function* handleRequest() {
          const { user } = yield* verifySession(request.headers);
          const { id } = yield* readSearchParams(MemberQuery, request);
          return yield* getMember(user.id, id);
        }),
      failures,
    ),
  )
  .get(
    "/members",
    api.route(
      MemberList,
      (request) =>
        Effect.gen(function* handleRequest() {
          yield* verifySession(request.headers);
          const { keyword, page } = yield* readSearchParams(MemberListQuery, request);
          const offset = (page - 1) * memberPageSize;
          const list = yield* listMembers({ keyword, limit: memberPageSize, offset });
          return { ...list, pageSize: memberPageSize };
        }),
      failures,
    ),
  )
  .patch(
    "/profile",
    api.route(
      ProfileView,
      (request) =>
        Effect.gen(function* handleRequest() {
          const { user } = yield* verifySession(request.headers);
          const values = yield* readJsonBody(ProfileUpdate, request);
          return yield* updateProfile(user.id, values);
        }),
      failures,
    ),
  );

const userApi = compileApi(app);

export { userApi };
