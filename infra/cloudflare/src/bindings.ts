import type { AIBinding, Assets, D1, Email, InferEnv } from "alchemy/Cloudflare";
import type { Redacted } from "effect";

type AppEnv = Readonly<{
  APP_ORIGIN: string;
  APP_RELEASE: string;
  AUTH_SECRET: Redacted.Redacted;
  DB: D1.Database;
  EMAIL: Email.SendEmail;
  EMAIL_FROM: string;
}>;

type WikiEnv = AppEnv & Readonly<{ AI: AIBinding }>;

type AppBindings = InferEnv<AppEnv & Readonly<{ ASSETS: Assets }>>;
type WikiBindings = InferEnv<WikiEnv & Readonly<{ ASSETS: Assets }>>;

export type { AppBindings, AppEnv, WikiBindings, WikiEnv };
