import { Context, Layer } from "effect";

import type { MailSettings } from "@repo/auth";
import type { AppConfig } from "@repo/config";

interface OpsMailShape extends MailSettings {
  readonly OPS_EMAIL: string;
}
class OpsMail extends Context.Service<OpsMail, OpsMailShape>()("@repo/service-member/OpsMail") {}

function opsMailLayer(config: AppConfig): Layer.Layer<OpsMail> {
  return Layer.succeed(OpsMail, {
    APP_ORIGIN: config.APP_ORIGIN,
    EMAIL_FROM: config.EMAIL_FROM,
    OPS_EMAIL: config.OPS_EMAIL,
    ...(config.EMAIL === undefined ? {} : { EMAIL: config.EMAIL }),
    ...(config.MAILPIT_SEND_URL === undefined
      ? {}
      : { MAILPIT_SEND_URL: config.MAILPIT_SEND_URL }),
  });
}

export { OpsMail, opsMailLayer };
