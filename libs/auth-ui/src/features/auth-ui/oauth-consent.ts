import { Schema } from "effect";

const ConsentSearch = Schema.Struct({ client_id: Schema.optionalKey(Schema.String) });
const consentSearch = Schema.toStandardSchemaV1(ConsentSearch);

const OAuthClientView = Schema.Struct({ client_name: Schema.optionalKey(Schema.String) });

const ConsentBody = Schema.Struct({
  accept: Schema.Boolean,
  oauth_query: Schema.String,
  scope: Schema.optionalKey(Schema.String),
});
const encodeConsentBody = Schema.encodePromise(Schema.fromJsonString(ConsentBody));

const postConsent = (fetchImpl: typeof fetch, decision: string): Promise<Response> =>
  fetchImpl("/api/auth/oauth2/consent", {
    body: decision,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });

export { OAuthClientView, consentSearch, encodeConsentBody, postConsent };
