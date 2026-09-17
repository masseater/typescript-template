import {
  AuthSecret,
  Email,
  Id,
  Nonnegative,
  Origin,
  Positive,
  Prefix,
  Recipients,
  SamplingRate,
  checkSharedConfig,
  originKeys,
} from "./config.ts";
import { Config, Effect, Redacted } from "effect";

const DEFAULT_JPY_PER_USD = 150;
const FULL_SAMPLING = 1;
const DEFAULT_USD = 0;

const budget = Config.all({
  budgetJpy: Config.schema(Positive, "BUDGET_JPY"),
  fixedCostUsd: Config.schema(Nonnegative, "TEMPLATE_FIXED_COST_USD").pipe(
    Config.withDefault(DEFAULT_USD),
  ),
  jpyPerUsd: Config.schema(Positive, "TEMPLATE_JPY_PER_USD").pipe(
    Config.withDefault(DEFAULT_JPY_PER_USD),
  ),
  recipients: Config.schema(Recipients, "ALERT_EMAIL"),
  reserveUsd: Config.schema(Nonnegative, "TEMPLATE_RESERVE_USD").pipe(
    Config.withDefault(DEFAULT_USD),
  ),
});

const settings = Config.all({
  accountId: Config.schema(Id, "CLOUDFLARE_ACCOUNT_ID"),
  budget,
  mailFrom: Config.schema(Email, "TEMPLATE_MAIL_FROM"),
  observabilitySampling: Config.schema(SamplingRate, "TEMPLATE_OBSERVABILITY_SAMPLING").pipe(
    Config.withDefault(FULL_SAMPLING),
  ),
  origins: Config.all({
    admin: Config.schema(Origin, originKeys.admin),
    user: Config.schema(Origin, originKeys.user),
    wiki: Config.schema(Origin, originKeys.wiki),
  }),
  prefix: Config.schema(Prefix, "TEMPLATE_PREFIX"),
  zoneId: Config.schema(Id, "CLOUDFLARE_ZONE_ID"),
}).pipe(Effect.flatMap(checkSharedConfig));

const authSecret = Config.schema(AuthSecret, "TEMPLATE_AUTH_SECRET").pipe(
  Config.map(Redacted.make),
);

export { authSecret, settings };
