import type { Application, Capability, CapabilityOf } from "@repo/config";
import type { photoBucketBinding } from "@repo/config/storage";
import type { AIBinding, Assets, D1, Email, Flagship, InferEnv, R2 } from "alchemy/Cloudflare";
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

type BillingEnv = Readonly<{
  STRIPE_PRICE_ID: Redacted.Redacted;
  STRIPE_SECRET_KEY: Redacted.Redacted;
  STRIPE_WEBHOOK_SECRET: Redacted.Redacted;
}>;

type WikiEnv = SharedEnv &
  Readonly<{
    FLAGSHIP_API_TOKEN: Redacted.Redacted;
    FLAGSHIP_APP_ID: string;
  }>;

interface CapabilityEnv {
  readonly ai: Readonly<{ AI: AIBinding }>;
  readonly billing: BillingEnv;
  readonly storage: Readonly<Record<typeof photoBucketBinding, R2.Bucket>>;
}

type Intersection<Members> = (Members extends unknown ? (member: Members) => void : never) extends (
  member: Member,
) => void
  ? Member
  : never;

type GrantedEnv<App extends Application> = [CapabilityOf<App>] extends [never]
  ? unknown
  : Intersection<CapabilityEnv[CapabilityOf<App>]>;

type AppEnv<App extends Application> = SharedEnv & GrantedEnv<App>;
type DeclaredEnv = SharedEnv & Partial<CapabilityEnv[Capability]>;

type AppBindings<App extends Application> = InferEnv<AppEnv<App> & Readonly<{ ASSETS: Assets }>>;

export type { AppBindings, AppEnv, BillingEnv, CapabilityEnv, DeclaredEnv, SharedEnv, WikiEnv };
