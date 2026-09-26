import { Config, ConfigProvider, Effect, Option, Schema, SchemaGetter } from "effect";

const switchSpellings = ["1", "true", "0", "false"] as const;

type SwitchSpelling = (typeof switchSpellings)[number];

const Switch = Schema.Literals(switchSpellings).pipe(
  Schema.decodeTo(Schema.Boolean, {
    decode: SchemaGetter.transform(
      (spelling: SwitchSpelling): boolean => spelling === "1" || spelling === "true",
    ),
    encode: SchemaGetter.transform((on: boolean): SwitchSpelling => (on ? "1" : "0")),
  }),
);

const AbsoluteUrl = Schema.String.check(
  Schema.makeFilter((candidate: string) => URL.canParse(candidate) || "Expected an absolute URL"),
);

const settingWhenPresent = <T>(
  codec: Schema.Codec<T, string>,
  variable: string,
): Config.Config<T | undefined> =>
  Config.option(Config.schema(codec, variable)).pipe(Config.map(Option.getOrUndefined));

const textSetting = (variable: string): Config.Config<string | undefined> =>
  settingWhenPresent(Schema.String, variable);

const switchSetting = (variable: string): Config.Config<boolean> =>
  Config.schema(Switch, variable).pipe(Config.withDefault(false));

const continuousIntegration = switchSetting("CI");

const telemetryEnableVariable = "MST_TELEMETRY";

const sharedEndpoint = settingWhenPresent(AbsoluteUrl, "OTEL_EXPORTER_OTLP_ENDPOINT");

const signalEndpoint = (signal: "logs" | "metrics" | "traces"): Config.Config<string | undefined> =>
  Config.all({
    own: settingWhenPresent(AbsoluteUrl, `OTEL_EXPORTER_OTLP_${signal.toUpperCase()}_ENDPOINT`),
    shared: sharedEndpoint,
  }).pipe(
    Config.map(
      ({ own, shared }) =>
        own ?? (shared === undefined ? undefined : `${shared.replace(/\/+$/u, "")}/v1/${signal}`),
    ),
  );

const telemetrySettings = Config.all({
  asked: switchSetting(telemetryEnableVariable),
  disabled: switchSetting("OTEL_SDK_DISABLED"),
  logs: signalEndpoint("logs"),
  metrics: signalEndpoint("metrics"),
  traces: signalEndpoint("traces"),
}).pipe(
  Config.map(({ asked, disabled, logs, metrics, traces }) => ({
    measured: asked && !disabled,
    logs,
    metrics,
    traces,
  })),
);

type TelemetrySettings = Config.Success<typeof telemetrySettings>;

const cloudflareEnvironmentFileVariable = "TEMPLATE_CLOUDFLARE_ENV_FILE";

const cloudflareEnvironmentFile = textSetting(cloudflareEnvironmentFileVariable);

const configurationHome = textSetting("XDG_CONFIG_HOME");

const throttleLimit = textSetting("MST_THROTTLE_LIMIT");

const processSetting = <T>(setting: Config.Config<T>): T =>
  Effect.runSync(
    setting.pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv())),
  );

const inheritedEnvironment = (
  source: Readonly<Record<string, string | undefined>> = process.env,
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(source).flatMap(([variable, setting]) =>
      setting === undefined || setting === "" ? [] : [[variable, setting] as const],
    ),
  );

export {
  cloudflareEnvironmentFile,
  cloudflareEnvironmentFileVariable,
  configurationHome,
  continuousIntegration,
  inheritedEnvironment,
  processSetting,
  telemetryEnableVariable,
  telemetrySettings,
  textSetting,
  throttleLimit,
};
export type { TelemetrySettings };
