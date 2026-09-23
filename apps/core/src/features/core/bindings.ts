type CoreBindings = {
  readonly AUTH_SECRET: string;
  readonly DB: D1Database;
  readonly EMAIL: SendEmail;
  readonly EMAIL_FROM: string;
};

export type { CoreBindings };
