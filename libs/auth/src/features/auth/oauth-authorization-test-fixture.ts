import { httpStatus, type Application } from "@repo/config";
import { Effect, Schema } from "effect";

import { clientOf } from "./auth-test-fixture.ts";
import { origins, type BrowserClient } from "./browser-client-test-fixture.ts";
import { UnexpectedStatus } from "./unexpected-status-test-fixture.ts";

type AuthorizationFlow = {
  readonly clientId: string;
  readonly oauthQuery: string;
  readonly verifier: string;
};

type OAuthClient = Readonly<{
  application: Application;
  clientName: string;
  redirectUri: string;
  scope: string;
}>;

const VERIFIER_BYTES = 32;
const Registration = Schema.Struct({ client_id: Schema.String });

const pkceChallenge = Effect.fn("pkceChallenge")(function* pkceChallenge(verifier: string) {
  const digest = yield* Effect.promise(() =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  return Buffer.from(digest).toString("base64url");
});

const authorizeUrl = (oauth: OAuthClient, clientId: string, challenge: string): URL => {
  const origin = origins[oauth.application];
  const authorizeQuery = new URLSearchParams({
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: oauth.redirectUri,
    resource: `${origin}/mcp`,
    response_type: "code",
    scope: oauth.scope,
    state: "state-value",
  });
  return new URL(`/api/auth/oauth2/authorize?${authorizeQuery.toString()}`, origin);
};

const registerClient = Effect.fn("registerClient")(function* registerClient(
  oauth: OAuthClient,
  anonymous: BrowserClient,
) {
  const registration = yield* anonymous.json("/oauth2/register", {
    client_name: oauth.clientName,
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: [oauth.redirectUri],
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

const startOAuthAuthorization = Effect.fn("startOAuthAuthorization")(
  function* startOAuthAuthorization(oauth: OAuthClient) {
    const anonymous = yield* clientOf(oauth.application);
    const clientId = yield* registerClient(oauth, anonymous);
    const verifier = Buffer.from(crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES))).toString(
      "base64url",
    );
    const redirect = yield* anonymous.navigate(
      authorizeUrl(oauth, clientId, yield* pkceChallenge(verifier)).href,
    );
    const login = new URL(redirect.headers.get("location") ?? "", origins[oauth.application]);
    const flow: AuthorizationFlow = { clientId, oauthQuery: login.search.slice(1), verifier };
    return flow;
  },
);

export { startOAuthAuthorization };
export type { AuthorizationFlow, OAuthClient };
