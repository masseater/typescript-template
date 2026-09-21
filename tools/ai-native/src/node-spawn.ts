type PipeableStream = {
  pipe: (destination: unknown, options?: { end?: boolean }) => PipeableStream;
};

type SpawnOptions = {
  readonly cwd?: string;
  readonly detached?: boolean;
  readonly env?: NodeJS.ProcessEnv;
  readonly stdio?: "inherit" | "ignore" | readonly (string | number)[];
  readonly windowsHide?: boolean;
};

type SpawnLaunch = {
  readonly executable: string;
  readonly handed?: readonly string[];
  readonly spawnOptions?: SpawnOptions;
};

const spawnedProcessApi = process.getBuiltinModule("child_process");

type NodeChild = ReturnType<typeof spawnedProcessApi.spawn>;

type SpawnedChild = {
  readonly exitCode: NodeChild["exitCode"];
  readonly pid: NodeChild["pid"];
  readonly signalCode: NodeChild["signalCode"];
  readonly stderr: PipeableStream | null;
  readonly stdout: PipeableStream | null;
  kill: NodeChild["kill"];
  once: NodeChild["once"];
};

type SyncExit = {
  readonly error?: Error | undefined;
  readonly status: number | null;
  readonly stderr: string | Buffer;
  readonly stdout: string | Buffer;
};

const asPipeable = (stream: NodeChild["stdout"]): PipeableStream | null =>
  stream === null ? null : (stream as PipeableStream);

type NodeSpawnOptions = Parameters<typeof spawnedProcessApi.spawn>[2];

const spawnChild = (launch: SpawnLaunch): SpawnedChild => {
  const child = spawnedProcessApi.spawn(
    launch.executable,
    [...(launch.handed ?? [])],
    launch.spawnOptions as NodeSpawnOptions,
  );
  return {
    get exitCode() {
      return child.exitCode;
    },
    get pid() {
      return child.pid;
    },
    get signalCode() {
      return child.signalCode;
    },
    get stderr() {
      return asPipeable(child.stderr);
    },
    get stdout() {
      return asPipeable(child.stdout);
    },
    kill: child.kill.bind(child),
    once: child.once.bind(child),
  };
};

const spawnChildSync = (launch: SpawnLaunch): SyncExit => {
  const exit = spawnedProcessApi.spawnSync(
    launch.executable,
    [...(launch.handed ?? [])],
    launch.spawnOptions as NodeSpawnOptions,
  );
  return {
    error: exit.error,
    status: exit.status,
    stderr: exit.stderr,
    stdout: exit.stdout,
  };
};

export { spawnChild, spawnChildSync };
export type { SpawnedChild, SpawnOptions, SyncExit };
