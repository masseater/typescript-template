import { verifySession } from "@repo/auth";
import { requireSignupAgreements } from "@repo/db";
import { httpStatus } from "@repo/observability";
import { sessionFailures } from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  FollowList,
  FollowMember,
  FollowMemberQuery,
  FollowState,
  HomeFeed,
  NavBadges,
  NotificationId,
  NotificationList,
  NotificationPreferences,
  NotificationUnread,
  OnboardingAdvance,
  OnboardingView,
} from "#shared/contracts/index.ts";
import {
  advanceOnboarding,
  followMember,
  homeFeed,
  isFollowing,
  listFollowers,
  listFollowing,
  stepOf,
  unfollowMember,
} from "./member-social.ts";
import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  navBadges,
  unreadNotificationCount,
  updateNotificationPreferences,
} from "./notifications.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";
import type { OpsMail } from "./ops-mail.ts";

const failures = {
  ...sessionFailures,
  EmailDeliveryFailed: "unexpected",
  FollowSelfForbidden: {
    message: "自分自身をフォローすることはできません。",
    status: httpStatus.badRequest,
  },
  NotificationNotFound: {
    message: "通知が見つかりません。",
    status: httpStatus.notFound,
  },
  UserNotFound: { message: "対象が見つかりません。", status: httpStatus.notFound },
} as const;

const onboardingFailures = {
  ...failures,
  AgreementRequired: {
    message: "最新の利用規約への同意が必要です。",
    status: httpStatus.preconditionRequired,
  },
};

function onboardingStepApi(api: ApiRoutes<AppServices>) {
  return createApi("").get(
    "/onboarding",
    ...api.route(
      { response: OnboardingView },
      (request) =>
        Effect.gen(function* handle() {
          const { user } = yield* verifySession(request.headers);
          return { step: yield* stepOf(user.id) };
        }),
      failures,
    ),
  );
}

function socialApi(api: ApiRoutes<AppServices | OpsMail>) {
  return createApi("")
    .post(
      "/onboarding",
      ...api.route(
        { response: OnboardingView },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { step } = yield* readJsonBody(OnboardingAdvance, request);
            if ((yield* stepOf(user.id)) === "agreement" && step !== "agreement") {
              yield* requireSignupAgreements(user.id);
            }
            yield* advanceOnboarding(user.id, step);
            return { step };
          }),
        onboardingFailures,
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
        failures,
      ),
    )
    .get(
      "/social/follow",
      ...api.route(
        { response: FollowState },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { memberId } = yield* readSearchParams(FollowMemberQuery, request);
            return { following: yield* isFollowing(user.id, memberId) };
          }),
        failures,
      ),
    )
    .put(
      "/social/follow",
      ...api.route(
        { response: FollowMember },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { memberId } = yield* readJsonBody(FollowMemberQuery, request);
            yield* followMember(user.id, memberId);
            return { ok: true as const };
          }),
        failures,
      ),
    )
    .delete(
      "/social/follow",
      ...api.route(
        { response: FollowMember },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { memberId } = yield* readJsonBody(FollowMemberQuery, request);
            yield* unfollowMember(user.id, memberId);
            return { ok: true as const };
          }),
        failures,
      ),
    )
    .get(
      "/social/followers",
      ...api.route(
        { response: FollowList },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { memberId } = yield* readSearchParams(FollowMemberQuery, request);
            return { members: yield* listFollowers(user.id, memberId) };
          }),
        failures,
      ),
    )
    .get(
      "/social/following",
      ...api.route(
        { response: FollowList },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { memberId } = yield* readSearchParams(FollowMemberQuery, request);
            return { members: yield* listFollowing(user.id, memberId) };
          }),
        failures,
      ),
    )
    .get(
      "/notifications",
      ...api.route(
        { response: NotificationList },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return { items: yield* listNotifications(user.id) };
          }),
        failures,
      ),
    )
    .get(
      "/notifications/unread",
      ...api.route(
        { response: NotificationUnread },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return { count: yield* unreadNotificationCount(user.id) };
          }),
        failures,
      ),
    )
    .post(
      "/notifications/read",
      ...api.route(
        { response: FollowMember },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { id } = yield* readJsonBody(NotificationId, request);
            yield* markNotificationRead(user.id, id);
            return { ok: true as const };
          }),
        failures,
      ),
    )
    .post(
      "/notifications/read-all",
      ...api.route(
        { response: FollowMember },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            yield* markAllNotificationsRead(user.id);
            return { ok: true as const };
          }),
        failures,
      ),
    )
    .get(
      "/notifications/preferences",
      ...api.route(
        { response: NotificationPreferences },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return yield* getNotificationPreferences(user.id);
          }),
        failures,
      ),
    )
    .patch(
      "/notifications/preferences",
      ...api.route(
        { response: NotificationPreferences },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const preferences = yield* readJsonBody(NotificationPreferences, request);
            return yield* updateNotificationPreferences(user.id, preferences);
          }),
        failures,
      ),
    )
    .get(
      "/nav/badges",
      ...api.route(
        { response: NavBadges },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return yield* navBadges(user.id);
          }),
        failures,
      ),
    );
}

export { onboardingStepApi, socialApi };
