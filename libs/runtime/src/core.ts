import { APPLICATION, type AgreementKind, type Application } from "@repo/config";
import {
  AdminRpcs,
  EmailVerificationFailed,
  InternalRpcs,
  MemberRpcs,
  SessionInvalid,
  SessionRequired,
  forwardAuthRequest,
  makeCoreClient,
  withForwardedCookies,
  type AgreementsView,
  type PublishedAgreementView,
} from "@repo/core-api";
import {
  AgreementRequired,
  AgreementVersionUnavailable,
  AgreementWithdrawalUnavailable,
  InviteRejected,
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
      Effect.gen(function* acceptInviteRpc() {
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

export {
  Core,
  acceptAgreements,
  acceptInvite,
  ensureCoreReady,
  forwardAuth,
  listAgreements,
  previewInvite,
  publishedAgreement,
  readSession,
  requireCurrentAgreements,
  verifyEmail,
  withdrawAgreement,
};
export type {
  AgreementRpcError,
  CoreReadyError,
  CoreShape,
  InviteRpcError,
  SessionRpcError,
  VerifyEmailRpcError,
};
