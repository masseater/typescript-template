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
import { apiDocs, apiRoot, apiRoutes, compileApi, createApi } from "@template/runtime/http";
import { Effect } from "effect";
import { httpStatus } from "@template/observability";
import { interviewApi } from "./interview-api.ts";
import { runtime } from "./runtime.ts";
import { verifySession } from "@template/auth";

const api = apiRoutes(runtime);
const failures = {
  ...unavailable,
  UserNotFound: { message: "対象が見つかりません。", status: httpStatus.notFound },
};

const app = createApi(apiRoot)
  .use(apiDocs("user"))
  .use(accountApi(api))
  .use(interviewApi(api))
  .get(
    "/profile",
    ...api.route(
      { response: ProfileView },
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
    "/member",
    ...api.route(
      { query: MemberQuery, response: MemberView },
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (request, { id }) =>
        Effect.gen(function* handleRequest() {
          const { user } = yield* verifySession(request.headers);
          return yield* getMember(user.id, id);
        }),
      failures,
    ),
  )
  .get(
    "/members",
    ...api.route(
      { query: MemberListQuery, response: MemberList },
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (request, { keyword, page }) =>
        Effect.gen(function* handleRequest() {
          yield* verifySession(request.headers);
          const offset = (page - 1) * memberPageSize;
          const list = yield* listMembers({ keyword, limit: memberPageSize, offset });
          return { ...list, pageSize: memberPageSize };
        }),
      failures,
    ),
  )
  .patch(
    "/profile",
    ...api.route(
      { body: ProfileUpdate, response: ProfileView },
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (request, values) =>
        Effect.gen(function* handleRequest() {
          const { user } = yield* verifySession(request.headers);
          return yield* updateProfile(user.id, values);
        }),
      failures,
    ),
  );

const userApi = compileApi(app);

export { userApi };
