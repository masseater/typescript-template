import { CloudflareApiLive, Credentials } from "@alchemy.run/cloudflare";
import { formatHeaders } from "@distilled.cloud/cloudflare/Credentials";
import { AuthProviders } from "alchemy";
import { PlatformServices } from "alchemy/Util/PlatformServices";
import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/http";

import { runHookWith, writeJson } from "./env.ts";

const Headers = Schema.Record(Schema.String, Schema.String);

const cloudflareApi = CloudflareApiLive().pipe(
  Layer.provide(Layer.succeed(AuthProviders, {})),
  Layer.provide(PlatformServices),
  Layer.provide(FetchHttpClient.layer),
);

runHookWith(cloudflareApi)(
  Effect.gen(function* cloudflareMcpHeaders() {
    const resolve = yield* Credentials;
    const credentials = yield* resolve;
    yield* writeJson(Headers, formatHeaders(credentials));
  }),
);
