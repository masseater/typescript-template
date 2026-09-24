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

type OAuthClient = {
  readonly application: Application;
  readonly clientName: string;
  readonly redirectUri: string;
  readonly scope: string;
};

const VERIFIER_BYTES = 32;
const Registration = Schema.Struct({ client_id: Schema.String });

const encodeBase64Url = (bytes: Readonly<Uint8Array>): string =>
  btoa(Array.from(bytes, (codePoint) => String.fromCodePoint(codePoint)).join(""))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

const pkceChallenge = Effect.fn("pkceChallenge")(function* pkceChallenge(verifier: string) {
  const digest = yield* Effect.promise(() =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  return encodeBase64Url(new Uint8Array(digest));
});

const authorizeUrl = ({
  challenge,
  clientId,
  oauthClient,
}: Readonly<{ challenge: string; clientId: string; oauthClient: OAuthClient }>): URL => {
  const origin = origins[oauthClient.application];
  const authorizeQuery = new URLSearchParams({
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: oauthClient.redirectUri,
    resource: `${origin}/mcp`,
    response_type: "code",
    scope: oauthClient.scope,
    state: "state-value",
  });
  return new URL(`/api/auth/oauth2/authorize?${authorizeQuery.toString()}`, origin);
};

const registerClient = Effect.fn("registerClient")(function* registerClient(
  anonymous: Readonly<BrowserClient>,
  oauthClient: OAuthClient,
) {
  const registration = yield* anonymous.json("/oauth2/register", {
    client_name: oauthClient.clientName,
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: [oauthClient.redirectUri],
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

const startClientAuthorization = Effect.fn("startClientAuthorization")(
  function* startClientAuthorization(oauthClient: OAuthClient) {
    const anonymous = yield* clientOf(oauthClient.application);
    const clientId = yield* registerClient(anonymous, oauthClient);
    const verifier = encodeBase64Url(crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES)));
    const challenge = yield* pkceChallenge(verifier);
    const redirect = yield* anonymous.navigate(
      authorizeUrl({ challenge, clientId, oauthClient }).href,
    );
    const login = new URL(redirect.headers.get("location") ?? "", origins[oauthClient.application]);
    const flow: AuthorizationFlow = { clientId, oauthQuery: login.search.slice(1), verifier };
    return flow;
  },
);

export { startClientAuthorization };
export type { AuthorizationFlow };
