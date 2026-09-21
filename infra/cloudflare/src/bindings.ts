import type { Application, Capability, CapabilityOf } from "@repo/config";
import type { cacheNamespaceBinding, fileBucketBinding } from "@repo/config/storage";
import type {
  AIBinding,
  Assets,
  D1,
  DurableObjectLike,
  Email,
  Flagship,
  InferEnv,
  KV,
  Queues,
  R2,
  WorkflowLike,
} from "alchemy/Cloudflare";
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
  readonly billing: BillingEnv;
  readonly jobs: Readonly<{
    JOBS: Queues.Queue;
    PROCESS: WorkflowLike<{ jobId: string }>;
  }>;
  readonly realtime: Readonly<{ USER_INBOX: DurableObjectLike }>;
  readonly storage: Readonly<
    Record<typeof fileBucketBinding, R2.Bucket> & Record<typeof cacheNamespaceBinding, KV.Namespace>
  >;
  readonly "workers-ai": Readonly<{ AI: AIBinding }>;
}

type UnionToIntersection<Union> = (Union extends unknown ? (value: Union) => void : never) extends (
  value: infer Intersection,
) => void
  ? Intersection
  : never;

type GrantedEnv<App extends Application> = [CapabilityOf<App>] extends [never]
  ? unknown
  : UnionToIntersection<CapabilityEnv[CapabilityOf<App>]>;

type AppEnv<App extends Application> = SharedEnv & GrantedEnv<App>;
type DeclaredEnv = SharedEnv & Partial<UnionToIntersection<CapabilityEnv[Capability]>>;

type AppBindings<App extends Application> = InferEnv<AppEnv<App> & Readonly<{ ASSETS: Assets }>>;

export type { AppBindings, AppEnv, BillingEnv, CapabilityEnv, DeclaredEnv, SharedEnv, WikiEnv };
