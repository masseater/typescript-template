import type { Application, Capability, CapabilityOf } from "@repo/config";
import type {
  AIBinding,
  Assets,
  D1,
  DurableObjectLike,
  Email,
  Flagship,
  InferEnv,
  Queues,
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
  readonly jobs: Readonly<{
    JOBS: Queues.Queue;
    PROCESS: WorkflowLike<{ jobId: string }>;
  }>;
  readonly realtime: Readonly<{ USER_INBOX: DurableObjectLike }>;
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

export type { AppBindings, AppEnv, CapabilityEnv, DeclaredEnv, SharedEnv, WikiEnv };
