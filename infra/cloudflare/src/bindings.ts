import type { Application, Capability, CapabilityOf } from "@repo/config";
import type { AIBinding, Assets, D1, Email, Flagship, InferEnv } from "alchemy/Cloudflare";
import type { Redacted } from "effect";

type SharedEnv = Readonly<{
  APP_ORIGIN: string;
  APP_RELEASE: string;
  AUTH_SECRET: Redacted.Redacted;
  DB: D1.Database;
  EMAIL: Email.SendEmail;
  EMAIL_FROM: string;
  FLAGSHIP_ACCOUNT_ID: string;
  FLAGS: Flagship.App;
  GOOGLE_ANALYTICS_MEASUREMENT_ID?: string;
  OPS_EMAIL: string;
  OTLP_AUTHORIZATION?: Redacted.Redacted;
  OTLP_ENABLED?: string;
  OTLP_ENDPOINT?: string;
}>;

type WikiEnv = SharedEnv &
  Readonly<{
    FLAGSHIP_API_TOKEN: Redacted.Redacted;
    FLAGSHIP_APP_ID: string;
  }>;

interface CapabilityEnv {
  readonly ai: Readonly<{ AI: AIBinding }>;
}

type GrantedEnv<App extends Application> = [CapabilityOf<App>] extends [never]
  ? unknown
  : CapabilityEnv[CapabilityOf<App>];

type AppEnv<App extends Application> = SharedEnv & GrantedEnv<App>;
type DeclaredEnv = SharedEnv & Partial<CapabilityEnv[Capability]>;

type AppBindings<App extends Application> = InferEnv<AppEnv<App> & Readonly<{ ASSETS: Assets }>>;

export type { AppBindings, AppEnv, CapabilityEnv, DeclaredEnv, SharedEnv, WikiEnv };
