import { env as processEnvironment } from "node:process";

const optionalSetting = (variable: string): string | undefined => {
  const setting = processEnvironment[variable];
  return typeof setting === "string" ? setting : undefined;
};

const telemetryAsked = optionalSetting("MST_TELEMETRY") !== undefined;

export { optionalSetting, telemetryAsked };
