const lifecycles = ["precommit", "prepush", "prepr", "premerge", "prerelease"] as const;
type Lifecycle = (typeof lifecycles)[number];

const lifecycleInherits: Readonly<Record<Lifecycle, readonly Lifecycle[]>> = {
  precommit: [],
  prepush: ["precommit"],
  prepr: ["prepush"],
  premerge: [],
  prerelease: ["prepr", "premerge"],
};

type LifecycleTask = {
  command: string[];
  dependsOn: string[];
};

const lifecycle = (
  stages: Readonly<Partial<Record<Lifecycle, readonly string[]>>> = {},
): {
  readonly precommit: LifecycleTask;
  readonly prepush: LifecycleTask;
  readonly prepr: LifecycleTask;
  readonly premerge: LifecycleTask;
  readonly prerelease: LifecycleTask;
} => ({
  precommit: {
    command: [],
    dependsOn: [...lifecycleInherits.precommit, ...(stages.precommit ?? [])],
  },
  prepush: {
    command: [],
    dependsOn: [...lifecycleInherits.prepush, ...(stages.prepush ?? [])],
  },
  prepr: {
    command: [],
    dependsOn: [...lifecycleInherits.prepr, ...(stages.prepr ?? [])],
  },
  premerge: {
    command: [],
    dependsOn: [...lifecycleInherits.premerge, ...(stages.premerge ?? [])],
  },
  prerelease: {
    command: [],
    dependsOn: [...lifecycleInherits.prerelease, ...(stages.prerelease ?? [])],
  },
});

export { lifecycle, lifecycleInherits, lifecycles };
