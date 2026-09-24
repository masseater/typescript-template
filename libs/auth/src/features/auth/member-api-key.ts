import { httpStatus, memberApiKeyHeader, memberApiKeyReadPermissions } from "@repo/config";
import { findUser } from "@repo/db";
import { Effect } from "effect";

import { ApiKeyWriteForbidden } from "./api-key-write-forbidden.ts";
import { Auth } from "./auth.ts";
import { assertEligibleUser } from "./policy.ts";
import { SessionRequired } from "./session-required.ts";
import { verifySession } from "./session.ts";

const bearerToken = (authorization: string | null): string | undefined => {
  if (authorization?.startsWith("Bearer ") !== true) {
    return undefined;
  }
  const token = authorization.slice("Bearer ".length).trim();
  return token === "" ? undefined : token;
};

const apiKeyFromHeaders = (headers: Headers): string | undefined => {
  const fromHeader = headers.get(memberApiKeyHeader);
  if (fromHeader !== null && fromHeader !== "") {
    return fromHeader;
  }
  return bearerToken(headers.get("authorization"));
};

const apiKeyOwnerId = Effect.fn("apiKeyOwnerId")(function* apiKeyOwnerId(presented: string) {
  const { instance } = yield* Auth;
  const verifyApiKey = yield* Effect.fromNullishOr(instance.api.verifyApiKey).pipe(
    Effect.mapError(() => new SessionRequired()),
  );
  const verified = yield* Effect.tryPromise({
    catch: () => new SessionRequired(),
    try: () =>
      verifyApiKey({
        body: { key: presented, permissions: memberApiKeyReadPermissions },
      }),
  });
  if (!verified.valid || verified.key === null) {
    return yield* new SessionRequired();
  }
  return verified.key.referenceId;
});

const verifyMemberApiKey = Effect.fn("verifyMemberApiKey")(function* verifyMemberApiKeyProgram(
  headers: Headers,
) {
  const presented = apiKeyFromHeaders(headers);
  if (presented === undefined) {
    return yield* new SessionRequired();
  }
  const { audience } = yield* Auth;
  const owner = (yield* findUser(yield* apiKeyOwnerId(presented))) ?? undefined;
  assertEligibleUser(owner, audience);
  const { email, id, name, role, twoFactorEnabled } = owner;
  return {
    session: { id: `api-key:${presented}` },
    strong: false,
    user: { email, id, name, role, twoFactorEnabled },
  } satisfies Readonly<{
    session: { readonly id: string };
    strong: boolean;
    user: {
      readonly email: string;
      readonly id: string;
      readonly name: string;
      readonly role: string;
      readonly twoFactorEnabled: boolean;
    };
  }>;
});

const verifySessionOrApiKey = Effect.fn("verifySessionOrApiKey")(
  function* verifySessionOrApiKeyProgram(headers: Headers, allowEnrollment?: boolean) {
    const presented = apiKeyFromHeaders(headers);
    if (presented === undefined) {
      return yield* verifySession(headers, allowEnrollment);
    }
    return yield* verifyMemberApiKey(headers);
  },
);

const verifySessionWriter = Effect.fn("verifySessionWriter")(function* verifySessionWriterProgram(
  headers: Headers,
  allowEnrollment?: boolean,
) {
  if (apiKeyFromHeaders(headers) !== undefined) {
    return yield* new ApiKeyWriteForbidden();
  }
  return yield* verifySession(headers, allowEnrollment);
});

const apiKeyWriteFailure = {
  ApiKeyWriteForbidden: {
    message: "APIキーでは書き込みできません。",
    status: httpStatus.forbidden,
  },
} as const;

export {
  apiKeyFromHeaders,
  apiKeyWriteFailure,
  verifyMemberApiKey,
  verifySessionOrApiKey,
  verifySessionWriter,
};
