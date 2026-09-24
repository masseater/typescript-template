const processEnvironment = process.env;

const optionalSetting = (variable: string): string | undefined => {
  const setting = processEnvironment[variable];
  return typeof setting === "string" ? setting : undefined;
};

const definedEnvironment = (): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(processEnvironment).flatMap(([variable, setting]) =>
      typeof setting === "string" ? [[variable, setting] as const] : [],
    ),
  );

export { definedEnvironment, optionalSetting };
