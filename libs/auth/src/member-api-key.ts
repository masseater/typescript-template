import { httpStatus, memberApiKeyHeader, memberApiKeyReadPermissions } from "@repo/config";
import { findUser } from "@repo/db";
import { Effect } from "effect";

import { ApiKeyWriteForbidden } from "./api-key-write-forbidden.ts";
import { Auth } from "./auth.ts";
import { assertEligibleUser } from "./policy.ts";
import { SessionRequired } from "./session-required.ts";
import { verifySession } from "./session.ts";

type VerifiedMember = Readonly<{
  session: { readonly id: string };
  strong: boolean;
  user: {
    readonly email: string;
    readonly id: string;
    readonly name: string;
    readonly permission: string | null;
    readonly role: string;
    readonly twoFactorEnabled: boolean;
  };
}>;

type VerifyApiKeyResult = Readonly<{
  readonly error: { readonly code: string } | null;
  readonly key: { readonly referenceId: string } | null;
  readonly valid: boolean;
}>;

function apiKeyFromHeaders(headers: Headers): string | undefined {
  const fromHeader = headers.get(memberApiKeyHeader);
  if (fromHeader !== null && fromHeader !== "") {
    return fromHeader;
  }
  const authorization = headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    if (token !== "") {
      return token;
    }
  }
  return undefined;
}

const verifyMemberApiKey = Effect.fn("verifyMemberApiKey")(function* verifyMemberApiKeyProgram(
  headers: Headers,
) {
  const presented = apiKeyFromHeaders(headers);
  if (presented === undefined) {
    return yield* new SessionRequired();
  }
  const { audience, instance } = yield* Auth;
  const verified = yield* Effect.tryPromise({
    catch: () => new SessionRequired(),
    try: () =>
      (
        instance.api as unknown as {
          verifyApiKey: (input: unknown) => Promise<VerifyApiKeyResult>;
        }
      ).verifyApiKey({
        body: { key: presented, permissions: memberApiKeyReadPermissions },
      }),
  });
  if (!verified.valid || verified.key === null) {
    return yield* new SessionRequired();
  }
  const owner = (yield* findUser(verified.key.referenceId)) ?? undefined;
  assertEligibleUser(owner, audience);
  const { email, id, name, permission, role, twoFactorEnabled } = owner;
  return {
    session: { id: `api-key:${presented}` },
    strong: false,
    user: { email, id, name, permission, role, twoFactorEnabled },
  } satisfies VerifiedMember;
});

const verifySessionOrApiKey = Effect.fn("verifySessionOrApiKey")(
  function* verifySessionOrApiKeyProgram(headers: Headers, allowEnrollment = false) {
    const presented = apiKeyFromHeaders(headers);
    if (presented === undefined) {
      return yield* verifySession(headers, allowEnrollment);
    }
    return yield* verifyMemberApiKey(headers);
  },
);

const verifySessionWriter = Effect.fn("verifySessionWriter")(function* verifySessionWriterProgram(
  headers: Headers,
  allowEnrollment = false,
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
