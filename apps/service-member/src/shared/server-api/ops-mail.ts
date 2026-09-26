import { ConfigurationInvalid, Email, appEnvKey } from "@repo/config";
import { readWorkerConfig } from "@repo/runtime/bindings";
import { Context, Effect, Layer, Schema } from "effect";

import type { MailSettings } from "@repo/auth";

interface OpsMailShape extends MailSettings {
  readonly OPS_EMAIL: string;
}
class OpsMail extends Context.Service<OpsMail, OpsMailShape>()("@repo/service-member/OpsMail") {}

const OpsMailEnvironment = Schema.Struct({ [appEnvKey.opsEmail]: Email });

function opsMailLayer(environment: unknown): Layer.Layer<OpsMail, ConfigurationInvalid> {
  return Layer.effect(
    OpsMail,
    Effect.gen(function* opsMail() {
      const config = yield* readWorkerConfig(environment);
      const { OPS_EMAIL } = yield* Schema.decodeUnknownEffect(OpsMailEnvironment)(environment).pipe(
        Effect.mapError((issue) => new ConfigurationInvalid({ reason: issue.message })),
      );
      return {
        APP_ORIGIN: config.APP_ORIGIN,
        EMAIL_FROM: config.EMAIL_FROM,
        OPS_EMAIL,
        ...(config.EMAIL === undefined ? {} : { EMAIL: config.EMAIL }),
        ...(config.MAILPIT_SEND_URL === undefined
          ? {}
          : { MAILPIT_SEND_URL: config.MAILPIT_SEND_URL }),
      };
    }),
  );
}

export { OpsMail, opsMailLayer };
