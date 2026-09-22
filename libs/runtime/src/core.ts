import { APPLICATION, type AgreementKind, type Application } from "@repo/config";
import {
  AdminRpcs,
  ApiKeyWriteForbidden,
  EmailVerificationFailed,
  InternalRpcs,
  MemberProfileNotFound,
  MemberRpcs,
  SessionInvalid,
  SessionRequired,
  StripeEventUnreadable,
  forwardAuthRequest,
  makeCoreClient,
  withForwardedCookies,
  type AgreementsView,
  type BillingPlanView,
  type MemberDirectoryList,
  type MemberDirectoryView,
  type MemberProfileUpdate,
  type MemberProfileView,
  type MemberSubscriptionView,
  type PublishedAgreementView,
  type StripeEventPayload,
  type WebhookOutcomeView,
} from "@repo/core-api";
import {
  AgreementRequired,
  AgreementVersionUnavailable,
  AgreementWithdrawalUnavailable,
  InviteRejected,
  PaidPlanRequired,
  UserNotFound,
} from "@repo/db";
import { Context, Effect } from "effect";

import type { DatabaseFailure } from "@repo/db";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import type {
  EmailVerified,
  InviteAcceptance,
  InviteAccepted,
  InvitePreview,
  SessionView,
} from "./contracts.ts";

type CoreShape = {
  readonly audience: Application;
  readonly fetcher: Fetcher;
};

class Core extends Context.Service<Core, CoreShape>()("@repo/runtime/Core") {}

type SessionRpcError = SessionInvalid | SessionRequired | RpcClientError;
type CoreReadyError = DatabaseFailure | RpcClientError;
type InviteRpcError = InviteRejected | RpcClientError;
type VerifyEmailRpcError = EmailVerificationFailed | RpcClientError;

const forwardAuth = (request: Request): Effect.Effect<Response, never, Core> =>
  Effect.gen(function* forwardAuthProgram() {
    const { fetcher } = yield* Core;
    return yield* Effect.promise(() => forwardAuthRequest(fetcher, request));
  });

const readSession = (
  request: Request,
): Effect.Effect<typeof SessionView.Type, SessionRpcError, Core> =>
  Effect.gen(function* readSessionProgram() {
    const { audience, fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* sessionRpc() {
        if (audience === APPLICATION.user) {
          const client = yield* makeCoreClient(MemberRpcs, fetcher);
          const identity = yield* client.getSession({}).pipe(withForwardedCookies(request.headers));
          return { strong: identity.strong, user: identity.user };
        }
        if (audience === APPLICATION.admin) {
          const client = yield* makeCoreClient(AdminRpcs, fetcher);
          const identity = yield* client.getSession({}).pipe(withForwardedCookies(request.headers));
          return { strong: identity.strong, user: identity.user };
        }
        const client = yield* makeCoreClient(InternalRpcs, fetcher);
        const identity = yield* client.getSession({}).pipe(withForwardedCookies(request.headers));
        return { strong: identity.strong, user: identity.user };
      }),
    );
  });

const ensureCoreReady = (): Effect.Effect<void, CoreReadyError, Core> =>
  Effect.gen(function* ensureCoreReadyProgram() {
    const { audience, fetcher } = yield* Core;
    yield* Effect.scoped(
      Effect.gen(function* readyRpc() {
        if (audience === APPLICATION.user) {
          const client = yield* makeCoreClient(MemberRpcs, fetcher);
          yield* client.databaseReady({});
          return;
        }
        const client = yield* makeCoreClient(
          audience === APPLICATION.admin ? AdminRpcs : InternalRpcs,
          fetcher,
        );
        yield* client.ready({});
      }),
    );
  });

const previewInvite = (
  token: string,
): Effect.Effect<typeof InvitePreview.Type, InviteRpcError, Core> =>
  Effect.gen(function* previewInviteProgram() {
    const { audience, fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* invitePreviewRpc() {
        if (audience === APPLICATION.admin) {
          const client = yield* makeCoreClient(AdminRpcs, fetcher);
          return yield* client.previewInvite({ token });
        }
        if (audience === APPLICATION.wiki) {
          const client = yield* makeCoreClient(InternalRpcs, fetcher);
          return yield* client.previewInvite({ token });
        }
        return yield* new InviteRejected({ reason: "missing" });
      }),
    );
  });

const acceptInvite = (
  acceptance: typeof InviteAcceptance.Type,
): Effect.Effect<typeof InviteAccepted.Type, InviteRpcError, Core> =>
  Effect.gen(function* acceptInviteProgram() {
    const { audience, fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* inviteAcceptRpc() {
        if (audience === APPLICATION.admin) {
          const client = yield* makeCoreClient(AdminRpcs, fetcher);
          return yield* client.acceptInvite(acceptance);
        }
        if (audience === APPLICATION.wiki) {
          const client = yield* makeCoreClient(InternalRpcs, fetcher);
          return yield* client.acceptInvite(acceptance);
        }
        return yield* new InviteRejected({ reason: "missing" });
      }),
    );
  });

const verifyEmail = (
  request: Request,
  token: string,
): Effect.Effect<typeof EmailVerified.Type, VerifyEmailRpcError, Core> =>
  Effect.gen(function* verifyEmailProgram() {
    const { audience, fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* verifyEmailRpc() {
        if (audience === APPLICATION.user) {
          const client = yield* makeCoreClient(MemberRpcs, fetcher);
          return yield* client.verifyEmail({ token }).pipe(withForwardedCookies(request.headers));
        }
        if (audience === APPLICATION.admin) {
          const client = yield* makeCoreClient(AdminRpcs, fetcher);
          return yield* client.verifyEmail({ token }).pipe(withForwardedCookies(request.headers));
        }
        const client = yield* makeCoreClient(InternalRpcs, fetcher);
        return yield* client.verifyEmail({ token }).pipe(withForwardedCookies(request.headers));
      }),
    );
  });

type AgreementRpcError =
  | AgreementRequired
  | AgreementVersionUnavailable
  | AgreementWithdrawalUnavailable
  | SessionInvalid
  | SessionRequired
  | RpcClientError;

const listAgreements = (
  request: Request,
): Effect.Effect<typeof AgreementsView.Type, SessionRpcError, Core> =>
  Effect.gen(function* listAgreementsProgram() {
    const { fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* listAgreementsRpc() {
        const client = yield* makeCoreClient(MemberRpcs, fetcher);
        return yield* client.listAgreements({}).pipe(withForwardedCookies(request.headers));
      }),
    );
  });

const acceptAgreements = (
  request: Request,
  versionIds: readonly string[],
): Effect.Effect<typeof AgreementsView.Type, AgreementVersionUnavailable | SessionRpcError, Core> =>
  Effect.gen(function* acceptAgreementsProgram() {
    const { fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* acceptAgreementsRpc() {
        const client = yield* makeCoreClient(MemberRpcs, fetcher);
        return yield* client
          .acceptAgreements({ versionIds })
          .pipe(withForwardedCookies(request.headers));
      }),
    );
  });

const publishedAgreement = (
  kind: AgreementKind,
): Effect.Effect<
  typeof PublishedAgreementView.Type,
  AgreementVersionUnavailable | RpcClientError,
  Core
> =>
  Effect.gen(function* publishedAgreementProgram() {
    const { fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* publishedAgreementRpc() {
        const client = yield* makeCoreClient(MemberRpcs, fetcher);
        return yield* client.publishedAgreement({ kind });
      }),
    );
  });

const withdrawAgreement = (
  request: Request,
  kind: AgreementKind,
): Effect.Effect<
  typeof AgreementsView.Type,
  AgreementWithdrawalUnavailable | SessionRpcError,
  Core
> =>
  Effect.gen(function* withdrawAgreementProgram() {
    const { fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* withdrawAgreementRpc() {
        const client = yield* makeCoreClient(MemberRpcs, fetcher);
        return yield* client
          .withdrawAgreement({ kind })
          .pipe(withForwardedCookies(request.headers));
      }),
    );
  });

const requireCurrentAgreements = (
  request: Request,
): Effect.Effect<void, AgreementRequired | SessionRpcError, Core> =>
  Effect.gen(function* requireCurrentAgreementsProgram() {
    const { fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* requireCurrentAgreementsRpc() {
        const client = yield* makeCoreClient(MemberRpcs, fetcher);
        return yield* client
          .requireCurrentAgreements({})
          .pipe(withForwardedCookies(request.headers));
      }),
    );
  });

type MemberProfileRpcError =
  | ApiKeyWriteForbidden
  | MemberProfileNotFound
  | SessionInvalid
  | SessionRequired
  | RpcClientError;

type MemberDirectoryRpcError = SessionRpcError | UserNotFound | RpcClientError;

const getMemberProfile = (
  request: Request,
): Effect.Effect<typeof MemberProfileView.Type, MemberProfileRpcError, Core> =>
  Effect.gen(function* getMemberProfileProgram() {
    const { fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* getMemberProfileRpc() {
        const client = yield* makeCoreClient(MemberRpcs, fetcher);
        return yield* client.getMemberProfile({}).pipe(withForwardedCookies(request.headers));
      }),
    );
  });

const updateMemberProfile = (
  request: Request,
  update: typeof MemberProfileUpdate.Type,
): Effect.Effect<typeof MemberProfileView.Type, MemberProfileRpcError, Core> =>
  Effect.gen(function* updateMemberProfileProgram() {
    const { fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* updateMemberProfileRpc() {
        const client = yield* makeCoreClient(MemberRpcs, fetcher);
        return yield* client
          .updateMemberProfile(update)
          .pipe(withForwardedCookies(request.headers));
      }),
    );
  });

const getMember = (
  request: Request,
  id: string,
): Effect.Effect<typeof MemberDirectoryView.Type, MemberDirectoryRpcError, Core> =>
  Effect.gen(function* getMemberProgram() {
    const { fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* getMemberRpc() {
        const client = yield* makeCoreClient(MemberRpcs, fetcher);
        return yield* client.getMember({ id }).pipe(withForwardedCookies(request.headers));
      }),
    );
  });

const listMembers = (
  request: Request,
  page: { readonly keyword?: string | undefined; readonly limit: number; readonly offset: number },
): Effect.Effect<typeof MemberDirectoryList.Type, SessionRpcError, Core> =>
  Effect.gen(function* listMembersProgram() {
    const { fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* listMembersRpc() {
        const client = yield* makeCoreClient(MemberRpcs, fetcher);
        return yield* client
          .listMembers({
            ...(page.keyword === undefined ? {} : { keyword: page.keyword }),
            limit: page.limit,
            offset: page.offset,
          })
          .pipe(withForwardedCookies(request.headers));
      }),
    );
  });

type BillingRpcError = PaidPlanRequired | SessionRpcError;

const getBillingPlan = (
  request: Request,
): Effect.Effect<typeof BillingPlanView.Type, SessionRpcError, Core> =>
  Effect.gen(function* getBillingPlanProgram() {
    const { fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* getBillingPlanRpc() {
        const client = yield* makeCoreClient(MemberRpcs, fetcher);
        return yield* client.getBillingPlan({}).pipe(withForwardedCookies(request.headers));
      }),
    );
  });

const getMemberSubscription = (
  request: Request,
): Effect.Effect<typeof MemberSubscriptionView.Type | null, SessionRpcError, Core> =>
  Effect.gen(function* getMemberSubscriptionProgram() {
    const { fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* getMemberSubscriptionRpc() {
        const client = yield* makeCoreClient(MemberRpcs, fetcher);
        return yield* client.getMemberSubscription({}).pipe(withForwardedCookies(request.headers));
      }),
    );
  });

const requirePaidMembership = (request: Request): Effect.Effect<void, BillingRpcError, Core> =>
  Effect.gen(function* requirePaidMembershipProgram() {
    const { fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* requirePaidMembershipRpc() {
        const client = yield* makeCoreClient(MemberRpcs, fetcher);
        return yield* client.requirePaidMembership({}).pipe(withForwardedCookies(request.headers));
      }),
    );
  });

const applyStripeEvent = (
  event: typeof StripeEventPayload.Type,
): Effect.Effect<typeof WebhookOutcomeView.Type, StripeEventUnreadable | RpcClientError, Core> =>
  Effect.gen(function* applyStripeEventProgram() {
    const { fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* applyStripeEventRpc() {
        const client = yield* makeCoreClient(MemberRpcs, fetcher);
        return yield* client.applyStripeEvent(event);
      }),
    );
  });

export {
  Core,
  acceptAgreements,
  acceptInvite,
  applyStripeEvent,
  ensureCoreReady,
  forwardAuth,
  getBillingPlan,
  getMember,
  getMemberProfile,
  getMemberSubscription,
  listAgreements,
  listMembers,
  previewInvite,
  publishedAgreement,
  readSession,
  requireCurrentAgreements,
  requirePaidMembership,
  updateMemberProfile,
  verifyEmail,
  withdrawAgreement,
};
export type {
  AgreementRpcError,
  BillingRpcError,
  CoreReadyError,
  CoreShape,
  InviteRpcError,
  MemberDirectoryRpcError,
  MemberProfileRpcError,
  SessionRpcError,
  VerifyEmailRpcError,
};
