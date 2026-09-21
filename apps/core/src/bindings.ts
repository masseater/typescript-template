import type { D1Database, SendEmail } from "@cloudflare/workers-types";

type CoreBindings = {
  readonly AUTH_SECRET: string;
  readonly DB: D1Database;
  readonly EMAIL: SendEmail;
  readonly EMAIL_FROM: string;
};

export type { CoreBindings };
