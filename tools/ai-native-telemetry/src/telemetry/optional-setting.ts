import { Config, Effect, Option } from "effect";

const optionalSetting = (variable: string): string | undefined =>
  Effect.runSync(Config.option(Config.string(variable)).pipe(Effect.map(Option.getOrUndefined)));

const telemetryAsked = optionalSetting("MST_TELEMETRY") !== undefined;

export { optionalSetting, telemetryAsked };
