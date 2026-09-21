import { verifySession } from "@repo/auth";
import {
  createAgreementDraft,
  listAgreementVersions,
  publishAgreementVersion,
  readAgreementVersion,
  reviseAgreementDraft,
} from "@repo/db/admin";
import { httpStatus } from "@repo/observability";
import { privileged } from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  AgreementDraft,
  AgreementDraftRevision,
  AgreementPublication,
  AgreementPublished,
  AgreementVersionDetail,
  AgreementVersionList,
  AgreementVersionQuery,
  AgreementVersionSaved,
} from "#shared/contracts/index.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = {
  ...privileged,
  AgreementVersionTaken: { message: "その版はすでにあります。", status: httpStatus.conflict },
  AgreementVersionUnavailable: {
    message: "版が見つからないか、すでに公開されています。",
    status: httpStatus.notFound,
  },
};

const timestamps = <
  Version extends { readonly createdAt: Date; readonly publishedAt: Date | null },
>(
  version: Version,
) => ({
  ...version,
  createdAt: version.createdAt.getTime(),
  publishedAt: version.publishedAt?.getTime() ?? null,
});

function agreementApi(api: ApiRoutes<AppServices>) {
  return createApi("")
    .get(
      "/agreements",
      ...api.route(
        { response: AgreementVersionList },
        (request) =>
          Effect.gen(function* handle() {
            const { session } = yield* verifySession(request.headers);
            const listed = yield* listAgreementVersions(session.id);
            return { ...listed, versions: listed.versions.map(timestamps) };
          }),
        failures,
      ),
    )
    .get(
      "/agreements/version",
      ...api.route(
        { response: AgreementVersionDetail },
        (request) =>
          Effect.gen(function* handle() {
            const { session } = yield* verifySession(request.headers);
            const { version } = yield* readSearchParams(AgreementVersionQuery, request);
            return timestamps(yield* readAgreementVersion(session.id, version));
          }),
        failures,
      ),
    )
    .post(
      "/agreements",
      ...api.route(
        { response: AgreementVersionSaved },
        (request) =>
          Effect.gen(function* handle() {
            const { session } = yield* verifySession(request.headers);
            const draft = yield* readJsonBody(AgreementDraft, request);
            return yield* createAgreementDraft({
              body: draft.body,
              kind: draft.kind,
              sessionId: session.id,
              summary: draft.summary,
              version: draft.version,
            });
          }),
        failures,
      ),
    )
    .patch(
      "/agreements",
      ...api.route(
        { response: AgreementVersionSaved },
        (request) =>
          Effect.gen(function* handle() {
            const { session } = yield* verifySession(request.headers);
            const revision = yield* readJsonBody(AgreementDraftRevision, request);
            return yield* reviseAgreementDraft({
              body: revision.body,
              id: revision.id,
              sessionId: session.id,
              summary: revision.summary,
            });
          }),
        failures,
      ),
    )
    .post(
      "/agreements/publish",
      ...api.route(
        { response: AgreementPublished },
        (request) =>
          Effect.gen(function* handle() {
            const { session } = yield* verifySession(request.headers);
            const { id } = yield* readJsonBody(AgreementPublication, request);
            return yield* publishAgreementVersion({ id, sessionId: session.id });
          }),
        failures,
      ),
    );
}

export { agreementApi };
