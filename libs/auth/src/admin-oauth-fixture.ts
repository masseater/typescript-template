import { APPLICATION } from "@repo/config";
import { ROLE } from "@repo/config";
import { ADMIN_PERMISSION, type AdminPermission } from "@repo/config/identity";
import { httpStatus } from "@repo/observability";
import { Effect, Schema } from "effect";

import {
  AuthApps,
  assignAdminPermissionByEmail,
  assignRoleByEmail,
  bootstrapVerifiedAdmin,
  clientOf,
  enableTotp,
  registerVerified,
  signInAs,
} from "./auth-test-fixture.ts";
import { origins, type BrowserClient } from "./browser-client.ts";
import { UnexpectedStatus } from "./unexpected-status.ts";

type AuthorizationFlow = {
  readonly clientId: string;
  readonly oauthQuery: string;
  readonly verifier: string;
};

const adminOrigin = origins[APPLICATION.admin];
const redirectUri = "http://127.0.0.1:43124/callback";
const VERIFIER_BYTES = 32;
const decodeRedirect = Schema.decodeUnknownEffect(Schema.Struct({ url: Schema.String }));
const Registration = Schema.Struct({ client_id: Schema.String });

const adminOperator = Effect.fn("adminOperator")(function* adminOperator(
  email: string,
  permission: AdminPermission = ADMIN_PERMISSION.operator,
) {
  yield* bootstrapVerifiedAdmin("keeper@example.com");
  yield* registerVerified(email);
  yield* assignRoleByEmail(email, ROLE.administrator);
  if (permission !== ADMIN_PERMISSION.owner) {
    yield* assignAdminPermissionByEmail(email, permission);
  }
  const client = yield* signInAs(APPLICATION.admin, email);
  yield* enableTotp(client);
  return client;
});

const pkceChallenge = Effect.fn("pkceChallenge")(function* pkceChallenge(verifier: string) {
  const digest = yield* Effect.promise(async () =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  return Buffer.from(digest).toString("base64url");
});

const authorizeUrl = (clientId: string, challenge: string): URL => {
  const authorizeQuery = new URLSearchParams({
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: redirectUri,
    resource: `${adminOrigin}/mcp`,
    response_type: "code",
    scope: "admin:read offline_access",
    state: "state-value",
  });
  return new URL(`/api/auth/oauth2/authorize?${authorizeQuery.toString()}`, adminOrigin);
};

const registerClient = Effect.fn("registerClient")(function* registerClient(
  anonymous: BrowserClient,
) {
  const registration = yield* anonymous.json("/oauth2/register", {
    client_name: "Test admin MCP client",
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: [redirectUri],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
  if (registration.status !== httpStatus.created) {
    return yield* new UnexpectedStatus({
      endpoint: "/oauth2/register",
      status: registration.status,
    });
  }
  return (yield* Schema.decodeUnknownEffect(Registration)(registration.body)).client_id;
});

const startAuthorization = Effect.fn("startAuthorization")(function* startAuthorization() {
  const anonymous = yield* clientOf(APPLICATION.admin);
  const clientId = yield* registerClient(anonymous);
  const verifier = Buffer.from(crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES))).toString(
    "base64url",
  );
  const redirect = yield* anonymous.navigate(
    authorizeUrl(clientId, yield* pkceChallenge(verifier)).href,
  );
  const login = new URL(redirect.headers.get("location") ?? "", adminOrigin);
  const flow: AuthorizationFlow = { clientId, oauthQuery: login.search.slice(1), verifier };
  return flow;
});

export { adminOperator, adminOrigin, startAuthorization };
