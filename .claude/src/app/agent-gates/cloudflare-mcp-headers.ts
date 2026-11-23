import { CloudflareApiLive, Credentials } from "@alchemy.run/cloudflare";
import { formatHeaders } from "@distilled.cloud/cloudflare/Credentials";
import { layer as nodeServices } from "@effect/platform-node/NodeServices";
import { AuthProviders } from "alchemy";
import { Effect, Layer, Schema } from "effect";
import { SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";

import { runHookWith, writeJson } from "#/shared/lib/env.ts";

const Headers = Schema.Record(Schema.String, Schema.String);

const cloudflareApi = CloudflareApiLive().pipe(
  Layer.provide(Layer.succeed(AuthProviders, {})),
  Layer.provide(nodeServices),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(SecureRandom.layerWebCrypto),
);

runHookWith(cloudflareApi)(
  Effect.gen(function* cloudflareMcpHeaders() {
    const resolve = yield* Credentials;
    const credentials = yield* resolve;
    yield* writeJson(Headers, formatHeaders(credentials));
  }),
);
