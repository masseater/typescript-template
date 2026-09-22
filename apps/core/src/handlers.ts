import { APPLICATION, type AgreementKind } from "@repo/config";
import {
  AdminRpcs,
  EmailVerificationFailed,
  InternalRpcs,
  MemberProfileNotFound,
  MemberRpcs,
  SessionIdentity,
  type AgreementAcceptance,
  type AgreementsView,
  type EmailVerified,
  type InviteAcceptance,
  type InviteAccepted,
  type InvitePreview,
  type MemberProfileUpdate,
  type MemberProfileView,
  type PublishedAgreementView,
  type SessionIdentityView,
} from "@repo/core-api";
import {
  AgreementRequired,
  AgreementVersionUnavailable,
  AgreementWithdrawalUnavailable,
  InviteRejected,
  checkDatabase,
  type Database,
  type DatabaseFailure,
} from "@repo/db";
import { Effect } from "effect";
import * as Layer from "effect/Layer";

import {
  acceptInvite as acceptInviteAccount,
  previewInvite as previewInviteAccount,
  verifyEmail as verifyEmailAccount,
} from "./account.ts";
import { authLayer } from "./auth-layer.ts";
import {
  acceptAgreements as acceptAgreementsMember,
  listAgreements as listAgreementsMember,
  publishedAgreement as publishedAgreementMember,
  requireCurrentAgreements as requireCurrentAgreementsMember,
  withdrawAgreement as withdrawAgreementMember,
} from "./member-agreements.ts";
import { readMemberProfile, writeMemberProfile } from "./member-profile.ts";
import { sessionIdentityMiddleware } from "./session-middleware.ts";

import type { Auth } from "@repo/auth";
import type * as HttpHeaders from "effect/unstable/http/Headers";
import type { Rpc } from "effect/unstable/rpc";
import type * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import type { CoreBindings } from "./bindings.ts";

const accountHandlers = {
  acceptInvite: (
    acceptance: typeof InviteAcceptance.Type,
  ): Effect.Effect<typeof InviteAccepted.Type, InviteRejected, Auth | Database> =>
    acceptInviteAccount(acceptance),
  previewInvite: ({
    token,
  }: {
    readonly token: string;
  }): Effect.Effect<typeof InvitePreview.Type, InviteRejected, Auth | Database> =>
    previewInviteAccount(token),
  verifyEmail: (
    { token }: { readonly token: string },
    { headers }: { readonly headers: HttpHeaders.Headers },
  ): Effect.Effect<typeof EmailVerified.Type, EmailVerificationFailed, Auth> =>
    verifyEmailAccount(token, headers),
} as const;

const memberHandlers = (
  bindings: CoreBindings,
): Layer.Layer<
  Rpc.ToHandler<RpcGroup.Rpcs<typeof MemberRpcs>> | Rpc.Middleware<RpcGroup.Rpcs<typeof MemberRpcs>>
> =>
  Layer.mergeAll(
    MemberRpcs.toLayer({
      acceptAgreements: (
        acceptance: typeof AgreementAcceptance.Type,
      ): Effect.Effect<
        typeof AgreementsView.Type,
        AgreementVersionUnavailable,
        SessionIdentity | Database
      > => acceptAgreementsMember(acceptance),
      databaseReady: (): Effect.Effect<boolean, DatabaseFailure, Database> =>
        checkDatabase().pipe(Effect.as(true)),
      getMemberProfile: (): Effect.Effect<
        typeof MemberProfileView.Type,
        MemberProfileNotFound,
        SessionIdentity | Database
      > =>
        Effect.gen(function* getMemberProfile() {
          const identity = yield* SessionIdentity;
          return yield* readMemberProfile(identity.user.id);
        }).pipe(Effect.catchTag("DatabaseFailure", (failure) => Effect.die(failure))),
      getSession: (): Effect.Effect<typeof SessionIdentityView.Type, never, SessionIdentity> =>
        SessionIdentity,
      listAgreements: (): Effect.Effect<
        typeof AgreementsView.Type,
        never,
        SessionIdentity | Database
      > => listAgreementsMember(),
      publishedAgreement: ({
        kind,
      }: {
        readonly kind: AgreementKind;
      }): Effect.Effect<
        typeof PublishedAgreementView.Type,
        AgreementVersionUnavailable,
        Database
      > => publishedAgreementMember(kind),
      requireCurrentAgreements: (): Effect.Effect<
        void,
        AgreementRequired,
        SessionIdentity | Database
      > => requireCurrentAgreementsMember(),
      updateMemberProfile: (
        update: typeof MemberProfileUpdate.Type,
      ): Effect.Effect<
        typeof MemberProfileView.Type,
        MemberProfileNotFound,
        SessionIdentity | Database
      > =>
        Effect.gen(function* updateMemberProfile() {
          const identity = yield* SessionIdentity;
          return yield* writeMemberProfile(identity.user.id, update);
        }).pipe(Effect.catchTag("DatabaseFailure", (failure) => Effect.die(failure))),
      verifyEmail: accountHandlers.verifyEmail,
      withdrawAgreement: ({
        kind,
      }: {
        readonly kind: AgreementKind;
      }): Effect.Effect<
        typeof AgreementsView.Type,
        AgreementWithdrawalUnavailable,
        SessionIdentity | Database
      > => withdrawAgreementMember(kind),
    }),
    sessionIdentityMiddleware(bindings, APPLICATION.user),
  ).pipe(Layer.provide(authLayer(bindings, APPLICATION.user)));

const adminHandlers = (
  bindings: CoreBindings,
): Layer.Layer<
  Rpc.ToHandler<RpcGroup.Rpcs<typeof AdminRpcs>> | Rpc.Middleware<RpcGroup.Rpcs<typeof AdminRpcs>>
> =>
  Layer.mergeAll(
    AdminRpcs.toLayer({
      ...accountHandlers,
      getSession: (): Effect.Effect<typeof SessionIdentityView.Type, never, SessionIdentity> =>
        SessionIdentity,
      ready: (): Effect.Effect<boolean> => Effect.succeed(true),
    }),
    sessionIdentityMiddleware(bindings, APPLICATION.admin),
  ).pipe(Layer.provide(authLayer(bindings, APPLICATION.admin)));

const internalHandlers = (
  bindings: CoreBindings,
): Layer.Layer<
  | Rpc.ToHandler<RpcGroup.Rpcs<typeof InternalRpcs>>
  | Rpc.Middleware<RpcGroup.Rpcs<typeof InternalRpcs>>
> =>
  Layer.mergeAll(
    InternalRpcs.toLayer({
      ...accountHandlers,
      getSession: (): Effect.Effect<typeof SessionIdentityView.Type, never, SessionIdentity> =>
        SessionIdentity,
      ready: (): Effect.Effect<boolean> => Effect.succeed(true),
    }),
    sessionIdentityMiddleware(bindings, APPLICATION.wiki),
  ).pipe(Layer.provide(authLayer(bindings, APPLICATION.wiki)));

export { adminHandlers, internalHandlers, memberHandlers };
