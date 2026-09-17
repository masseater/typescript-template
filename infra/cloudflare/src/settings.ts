import { Config, Effect, Redacted } from "effect";
import { parseSharedConfig, validateAuthSecret } from "./config.ts";

const DEFAULT_JPY_PER_USD = 150;
const DEFAULT_USD = 0;

const settingsKeys = [
  "ALERT_EMAIL",
  "BUDGET_JPY",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ZONE_ID",
  "TEMPLATE_ADMIN_ORIGIN",
  "TEMPLATE_AUTH_SECRET",
  "TEMPLATE_MAIL_FROM",
  "TEMPLATE_PREFIX",
  "TEMPLATE_USER_ORIGIN",
  "TEMPLATE_WIKI_ORIGIN",
] as const;

const budgetConfig = Config.all({
  budgetJpy: Config.number("BUDGET_JPY"),
  fixedCostUsd: Config.number("TEMPLATE_FIXED_COST_USD").pipe(Config.withDefault(DEFAULT_USD)),
  jpyPerUsd: Config.number("TEMPLATE_JPY_PER_USD").pipe(Config.withDefault(DEFAULT_JPY_PER_USD)),
  recipients: Config.string("ALERT_EMAIL").pipe(
    Config.map((value: string) => value.split(",").map((address) => address.trim())),
  ),
  reserveUsd: Config.number("TEMPLATE_RESERVE_USD").pipe(Config.withDefault(DEFAULT_USD)),
});

const settings = Config.all({
  accountId: Config.string("CLOUDFLARE_ACCOUNT_ID"),
  budget: budgetConfig,
  mailFrom: Config.string("TEMPLATE_MAIL_FROM"),
  origins: Config.all({
    admin: Config.string("TEMPLATE_ADMIN_ORIGIN"),
    user: Config.string("TEMPLATE_USER_ORIGIN"),
    wiki: Config.string("TEMPLATE_WIKI_ORIGIN"),
  }),
  prefix: Config.string("TEMPLATE_PREFIX"),
  zoneId: Config.string("CLOUDFLARE_ZONE_ID"),
}).pipe(Effect.flatMap(parseSharedConfig), Effect.orDie);

const authSecret = Config.redacted("TEMPLATE_AUTH_SECRET").pipe(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  Effect.tap((secret: Redacted.Redacted) => validateAuthSecret(Redacted.value(secret))),
  Effect.orDie,
);

export { authSecret, settings, settingsKeys };
