import { env as processEnvironment } from "node:process";

const optionalSetting = (variable: string): string | undefined => {
  const setting = processEnvironment[variable];
  return typeof setting === "string" ? setting : undefined;
};

const definedEnvironment = (): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(processEnvironment).flatMap(([variable, setting]) =>
      setting === undefined ? [] : [[variable, setting] as const],
    ),
  );

export { definedEnvironment, optionalSetting };
