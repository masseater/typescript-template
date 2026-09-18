const repositoryLocation: ReadonlySet<string> = new Set([
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_CONFIG",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_PARAMETERS",
  "GIT_DIR",
  "GIT_GRAFT_FILE",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_NO_REPLACE_OBJECTS",
  "GIT_OBJECT_DIRECTORY",
  "GIT_PREFIX",
  "GIT_REPLACE_REF_BASE",
  "GIT_SHALLOW_FILE",
  "GIT_WORK_TREE",
]);

function childEnvironment(
  overrides: Readonly<Record<string, string>>,
  withheld: ReadonlySet<string> = new Set(),
): Record<string, string> {
  // oxlint-disable-next-line node/no-process-env
  const inherited = Object.entries(process.env).flatMap(([name, value]) =>
    value === undefined || repositoryLocation.has(name) || withheld.has(name)
      ? []
      : [[name, value] as const],
  );
  return { ...Object.fromEntries(inherited), ...overrides };
}

export { childEnvironment };
