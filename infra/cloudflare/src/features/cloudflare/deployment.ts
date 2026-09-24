import { Config, ConfigProvider, Effect, Option } from "effect";

import { path } from "./platform.ts";

const ENVIRONMENT_FILE_VARIABLE = "TEMPLATE_CLOUDFLARE_ENV_FILE";

const setting = <Value>(config: Config.Config<Value>): Value =>
  Effect.runSync(config.parse(ConfigProvider.fromEnv()).pipe(Effect.orDie));

const optionalSetting = (name: string): string | undefined =>
  Option.getOrUndefined(setting(Config.option(Config.String(name))));

const environmentFile = (): string | undefined => optionalSetting(ENVIRONMENT_FILE_VARIABLE);

const secretsFileConfigured = (): boolean => environmentFile() !== undefined;

const configurationHome = (project: string): string =>
  path.join(
    optionalSetting("XDG_CONFIG_HOME") ?? path.join(setting(Config.String("HOME")), ".config"),
    project,
  );

const ENVIRONMENT_FILE_NAME = "cloudflare.env";

const secretsFile = (project: string): string => {
  const configured = environmentFile();
  return configured === undefined
    ? path.join(configurationHome(project), ENVIRONMENT_FILE_NAME)
    : path.resolve(configured);
};

export { ENVIRONMENT_FILE_VARIABLE, secretsFile, secretsFileConfigured };
