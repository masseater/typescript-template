import { Effect, Schema } from "effect";

import { encodeConsentBody, postConsent } from "../oauth-consent.ts";
import { decodeJson } from "../protocol.ts";

const sendConsent = (
  decision: Readonly<{ accept: boolean; scope?: string }>,
): Effect.Effect<void> =>
  Effect.gen(function* sendConsentDecision() {
    const encodedDecision = yield* Effect.promise(() =>
      encodeConsentBody({
        accept: decision.accept,
        oauth_query: globalThis.location.search.slice(1),
        ...(decision.scope === undefined ? {} : { scope: decision.scope }),
      }),
    );
    const served = yield* Effect.promise(() => postConsent(fetch, encodedDecision));
    if (!served.ok) {
      return yield* Effect.die(new Error("連携の許可を処理できませんでした。"));
    }
    const redirect = decodeJson(
      Schema.Struct({ url: Schema.String }),
      yield* Effect.promise(() => served.json()),
    );
    globalThis.location.assign(redirect.url);
  });

const submitConsent = (decision: Readonly<{ accept: boolean; scope?: string }>): Promise<void> =>
  Effect.runPromise(sendConsent(decision));

export { submitConsent };
