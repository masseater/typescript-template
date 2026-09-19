import { Context } from "effect";

import type { MailSettings } from "@repo/auth";

interface OpsMailShape extends MailSettings {
  readonly OPS_EMAIL: string;
}

class OpsMail extends Context.Service<OpsMail, OpsMailShape>()("@repo/runtime/OpsMail") {}

export { OpsMail };
